import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = "relative font-bold rounded-2xl transition-all duration-300 flex items-center justify-center active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group";
  
  const variants = {
    primary: "bg-gradient-to-r from-brand-yellow to-brand-gold text-black shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:-translate-y-1",
    secondary: "bg-neutral-900 text-white dark:bg-white dark:text-black shadow-lg hover:shadow-xl hover:opacity-90 hover:-translate-y-1",
    outline: "border-2 border-neutral-900 dark:border-white text-neutral-900 dark:text-white hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-black",
    ghost: "bg-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-10 py-4 text-lg",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {/* Shine Effect for Primary */}
      {variant === 'primary' && (
        <div className="absolute inset-0 -translate-x-[100%] group-hover:animate-shine bg-gradient-to-r from-transparent via-white/40 to-transparent z-10" />
      )}
      <span className="relative z-20 flex items-center">{children}</span>
    </button>
  );
};