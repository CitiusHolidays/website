# Citius Travel Website 

A modern travel agency website for Citius Holidays, built with Next.js. This project showcases curated travel experiences, MICE (Meetings, Incentives, Conferences, Exhibitions) services, a blog, gallery, and more. It is designed for high performance, beautiful UI, and easy content management.

## 🚀 Project Overview

- **Purpose:**
  - Present Citius Holidays' travel, MICE, and event services.
  - Showcase destinations, partners, awards, and client testimonials.
  - Enable users to browse services, view galleries, read the blog, and contact the team.
- **Key Features:**
  - Animated, responsive UI with modern design.
  - Dynamic content: blog, gallery, and services.
  - Contact form with email integration.
  - Sanity.io integration for content management (blog, gallery, etc.).
  - SEO-friendly and optimized for fast load times.

## 🛠️ Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Sanity.io](https://www.sanity.io/) (headless CMS)
- [Nodemailer](https://nodemailer.com/) (contact form email)
- [Lucide React](https://lucide.dev/) (icons)
- [Motion](https://motion.dev/) & [Motion Plus](https://motion.dev/plus) (animations)
- [React Hook Form](https://react-hook-form.com/) (forms)

## 📁 Folder Structure

- `src/app/` — Main Next.js app pages (Home, About, Services, MICE, Gallery, Blog, Contact, API routes)
- `src/components/` — Reusable UI and layout components
- `src/emails/` — Email templates for contact form
- `src/sanity/` — Sanity client configuration
- `src/static/` — Static images, videos, and assets
- `src/utils/` — Utility functions

## ⚡ Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the app.

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory with:
   ```env
   # Sanity Configuration (required)
   NEXT_PUBLIC_SANITY_PROJECT_ID=your_sanity_project_id
   NEXT_PUBLIC_SANITY_DATASET=production

   # Email Configuration (required for contact form)
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password

   # Optional: Enable Sanity preview mode for draft content
   # SANITY_PREVIEW=true
   ```

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## 📜 Available Scripts

- `dev` — Start the development server
- `build` — Build the app for production
- `start` — Start the production server
- `lint` — Run ESLint

## 📝 Content Management (Sanity.io)
- Blog posts, gallery images, and some content are managed via [Sanity.io](https://www.sanity.io/).
- See the `/blog` folder for Sanity schemas and configuration.

## 🤝 Contributing

1. Fork the repo and create your branch from `main`.
2. Install dependencies and run the dev server.
3. Make your changes and test thoroughly.
4. Submit a pull request with a clear description.

## 🙋‍♂️ Need Help?
- For issues or questions, open an issue or contact the maintainers.
- For business inquiries, use the contact form on the website.

## 📚 Learn More
- [Next.js Documentation](https://nextjs.org/docs)
- [Sanity Documentation](https://www.sanity.io/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

## 🚀 Deploy

Deploy easily on [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) or your preferred platform.

---

© Citius Holidays. All rights reserved. 
