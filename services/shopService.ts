
import { db, storage } from "../firebaseConfig";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, limit, runTransaction, Timestamp, where, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { UserProfile } from "./userService";

// --- Types ---

export interface FormFieldConfig {
  key: string;        // e.g., "address", "size", "twitter"
  label: string;      // e.g., "收货地址", "尺码"
  type: 'text' | 'number' | 'email' | 'select';
  required: boolean;
  options?: string[]; // For select type, comma separated string in UI, array here
  placeholder?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string; // Primary image (Thumb) - kept for backward compatibility
  images?: string[]; // NEW: Array of up to 5 image URLs
  price: number;
  stock: number;
  limitPerUser?: number; // 0 or undefined means unlimited
  isActive: boolean;
  formSchema: FormFieldConfig[]; // Dynamic form definition
  createdAt: any;
}

export interface Order {
  id: string;
  userId: string;
  userNickname: string;
  productId: string;
  productName: string;
  productImage?: string; // Snapshot of product image
  priceSnapshot: number; // Price at time of purchase
  formData: Record<string, string>; // The collected user input
  status: 'pending' | 'completed' | 'rejected';
  timestamp: any;
}

// --- Product Management (Admin) ---

// Upload Helper
export const uploadProductImage = async (file: File): Promise<string> => {
  const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

// Updated: Fixed Index Error by using Client-Side Sorting for filtered views
export const getProducts = async (
    onlyActive: boolean = true, 
    lastDoc?: QueryDocumentSnapshot, 
    pageSize: number = 20
): Promise<{ products: Product[], lastVisible: QueryDocumentSnapshot | null }> => {
  try {
    const constraints: any[] = [];
    
    // IMPORTANT FIX: 
    // We avoid using `orderBy` together with `where` to prevent "Requires Index" error.
    // We fetch items and sort them in memory (Client-side), which is fine for small shops.
    
    if (onlyActive) {
        // User View: Filter strictly by active (Required by Security Rules)
        constraints.push(where("isActive", "==", true));
        // We do NOT add orderBy here. We fetch up to 100 items and sort locally.
        constraints.push(limit(100)); 
    } else {
        // Admin View: No filter, so we can use orderBy safely
        constraints.push(orderBy("createdAt", "desc"));
        constraints.push(limit(pageSize));
        
        if (lastDoc) {
            constraints.push(startAfter(lastDoc));
        }
    }

    const q = query(collection(db, "products"), ...constraints);

    const snapshot = await getDocs(q);
    const products: Product[] = [];
    snapshot.forEach(doc => {
      products.push(doc.data() as Product);
    });
    
    // Client-side Sort for User View (Newest First)
    if (onlyActive) {
        products.sort((a, b) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tB - tA; // Descending
        });
    }
    
    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
    return { products, lastVisible };
  } catch (error) {
    console.error("Failed to fetch products:", error);
    throw error;
  }
};

export const saveProduct = async (product: Product, isNew: boolean) => {
  try {
      const ref = isNew ? doc(collection(db, "products")) : doc(db, "products", product.id);
      
      // Ensure imageUrl is set if images array exists
      let mainImage = product.imageUrl || "";
      if (product.images && product.images.length > 0 && !mainImage) {
          mainImage = product.images[0];
      }

      // Explicitly construct payload to remove 'undefined' fields which crash Firestore
      const payload = {
          id: ref.id,
          name: product.name || "未命名商品",
          description: product.description || "",
          price: Number(product.price) || 0,
          stock: Number(product.stock) || 0,
          limitPerUser: Number(product.limitPerUser) || 0,
          isActive: Boolean(product.isActive),
          imageUrl: mainImage,
          images: product.images || [],
          formSchema: product.formSchema || [],
          createdAt: isNew ? Timestamp.now() : (product.createdAt || Timestamp.now())
      };
      
      await setDoc(ref, payload, { merge: true });
  } catch (error) {
      console.error("Failed to save product:", error);
      throw error;
  }
};

export const deleteProduct = async (productId: string) => {
  await deleteDoc(doc(db, "products", productId));
};

// --- Order Processing (High Concurrency) ---

export const purchaseProduct = async (
    userId: string, 
    userNickname: string,
    productId: string, 
    formData: Record<string, string>
): Promise<{ success: boolean; message: string }> => {
  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Read Operations (Must come before any writes)
      const productRef = doc(db, "products", productId);
      const userRef = doc(db, "users", userId);
      
      const productDoc = await transaction.get(productRef);
      const userDoc = await transaction.get(userRef);

      if (!productDoc.exists()) throw "商品不存在";
      if (!userDoc.exists()) throw "用户不存在";

      const product = productDoc.data() as Product;
      const user = userDoc.data() as UserProfile;

      // 2. Logic Checks
      
      // Stock Check
      if (product.stock <= 0) {
          return { success: false, message: "手慢了！商品已售罄 (Out of Stock)" };
      }
      
      // Active Check
      if (!product.isActive) {
          return { success: false, message: "商品已下架" };
      }

      // Balance Check
      if (user.credits < product.price) {
          return { success: false, message: "蜂蜜余额不足" };
      }

      // Limit Check (New)
      if (product.limitPerUser && product.limitPerUser > 0) {
          const currentUsage = user.productUsage?.[productId] || 0;
          if (currentUsage >= product.limitPerUser) {
              return { success: false, message: `该商品每人限购 ${product.limitPerUser} 件` };
          }
      }

      // 3. Write Operations
      // Create Order
      const newOrderRef = doc(collection(db, "orders"));
      const newOrder: Order = {
          id: newOrderRef.id,
          userId,
          userNickname,
          productId,
          productName: product.name,
          productImage: product.imageUrl,
          priceSnapshot: product.price,
          formData,
          status: 'pending',
          timestamp: Timestamp.now()
      };

      transaction.set(newOrderRef, newOrder);
      
      // Update Inventory
      transaction.update(productRef, { stock: product.stock - 1 });
      
      // Deduct Credits & Update Usage
      const updatePayload: any = { 
          credits: user.credits - product.price 
      };
      
      // Increment product usage
      const currentUsage = user.productUsage?.[productId] || 0;
      updatePayload[`productUsage.${productId}`] = currentUsage + 1;

      transaction.update(userRef, updatePayload);

      return { success: true, message: "兑换成功！请在我的订单中查看。" };
    });
  } catch (e: any) {
    console.error("Transaction failed: ", e);
    return { success: false, message: typeof e === 'string' ? e : "交易失败，请稍后重试" };
  }
};

// --- Order Management ---

// Updated: Fixed Index Error by using Client-Side Sorting
export const getOrders = async (
    userId?: string,
    lastDoc?: QueryDocumentSnapshot,
    pageSize: number = 20
): Promise<{ orders: Order[], lastVisible: QueryDocumentSnapshot | null }> => {
    try {
        const constraints: any[] = [];
        
        if (userId) {
            // My Orders View: Filter by user, sort locally
            constraints.push(where("userId", "==", userId));
            constraints.push(limit(50)); // Fetch up to 50 recent orders
        } else {
            // Admin View: Sort by time
            constraints.push(orderBy("timestamp", "desc"));
            constraints.push(limit(pageSize));
            if (lastDoc) constraints.push(startAfter(lastDoc));
        }

        const q = query(collection(db, "orders"), ...constraints);
        
        const snapshot = await getDocs(q);
        const orders: Order[] = [];
        snapshot.forEach(doc => orders.push(doc.data() as Order));
        
        // Client-side Sort for User View
        if (userId) {
            orders.sort((a, b) => {
                const tA = a.timestamp?.seconds || 0;
                const tB = b.timestamp?.seconds || 0;
                return tB - tA;
            });
        }
        
        const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
        return { orders, lastVisible };
    } catch (e) {
        console.error("Fetch orders error", e);
        throw e;
    }
};

export const updateOrderStatus = async (orderId: string, status: 'pending' | 'completed' | 'rejected') => {
    await updateDoc(doc(db, "orders", orderId), { status });
};
