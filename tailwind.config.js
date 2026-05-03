/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#09090b",
        glassBg: "rgba(24, 24, 27, 0.6)",
        glassBorder: "rgba(255, 255, 255, 0.08)",
        primary: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
        },
        textMain: "#f8fafc",
        textMuted: "#94a3b8",
        danger: "#ef4444",
        success: "#10b981",
      },
      backgroundImage: {
        'glow': 'radial-gradient(circle at 15% 50%, rgba(59, 130, 246, 0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.08), transparent 25%)',
      },
      blur: {
        'glass': '12px',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.15)',
        'pulseRunning': '0 0 10px #10b981',
      },
      borderRadius: {
        'card': '16px',
      }
    },
  },
  plugins: [],
};
