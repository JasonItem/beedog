import JSZip from 'jszip';

/**
 * Loads an image from a base64 string or URL.
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Zips an array of base64 images into a single zip file.
 * @param stickers Array of objects containing label and base64 data string
 */
export const zipStickers = async (stickers: { label: string; data: string }[]): Promise<Blob> => {
  const zip = new JSZip();
  const folder = zip.folder("beedog_stickers");

  if (!folder) throw new Error("Failed to create zip folder");

  for (let i = 0; i < stickers.length; i++) {
    const { label, data } = stickers[i];
    
    // Ensure we have clean data
    if (!data) continue;

    // Data is likely "data:image/png;base64,......"
    // Remove header to get pure base64
    const base64Data = data.includes(',') ? data.split(',')[1] : data;
    
    // Clean label for filename, remove special chars, max length 20
    // Use regex to keep english, numbers, chinese characters
    const safeLabel = label.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 20);
    const filename = `${i + 1}_${safeLabel}.png`;
    
    folder.file(filename, base64Data, { base64: true });
  }

  return await zip.generateAsync({ type: "blob" });
};