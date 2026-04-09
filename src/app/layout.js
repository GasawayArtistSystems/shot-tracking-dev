import "./globals.css";
// import "../static/css/video-markup.css"; // ✅ Import your custom styles

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className="bg-gray-900 text-white">{children}</body>
        </html>
    );
}
