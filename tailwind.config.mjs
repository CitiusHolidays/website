import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{js,jsx,ts,tsx}"],
	theme: {
		extend: {
			colors: {
				citius: {
					blue: "#102A83",
					orange: "#F58220",
					green: "#8DC63F",
					lime: "#B5D43A",
				},
				brand: {
					dark: "#111827",
					muted: "#6B7280",
					light: "#F9FAFB",
					border: "#E5E7EB",
				},
			},
			fontFamily: {
				sans: ["Inter", ...defaultTheme.fontFamily.sans],
				heading: ["Poppins", ...defaultTheme.fontFamily.sans],
			},
		},
	},
	plugins: [],
};
