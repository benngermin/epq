# Insurance Exam Practice Application

## Overview
A comprehensive web application designed for insurance exam preparation. It features practice questions, immediate feedback with static explanations for incorrect answers, and AI-powered chat support for additional guidance. The project aims to provide an effective and interactive learning experience for users preparing for insurance certification exams, with ambitions to capture a significant market share in professional test preparation.

## User Preferences
I prefer iterative development with regular, small commits. I value clear, concise explanations and prefer to be asked before major architectural changes are made. Do not make changes to the folder `shared/`.

## System Architecture
The application follows a client-server architecture.
- **Frontend**: Built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui for a modern, responsive user interface. UI/UX emphasizes a clean, intuitive design suitable for both desktop and mobile views, including specific considerations for webview environments.
- **Backend**: Implemented using Node.js and Express in TypeScript, providing a robust API layer.
- **Data Layer**: Utilizes PostgreSQL as the primary database, managed with Drizzle ORM. The schema supports various question types, static explanations, user progress tracking, and course/question set organization.
- **Chat System**: Features real-time AI chat support implemented with Server-Sent Events (SSE) for efficient, low-latency communication.
- **Content Rendering**: Static explanations support markdown rendering, even when embedded within HTML, processed via a pipeline that includes detection, markdown-to-HTML conversion, and safe HTML rendering with Tailwind Typography for consistent styling.
- **Authentication**: Integrates Cognito SSO and local authentication for secure user access.
- **Key Features**: Includes practice exams, AI chat assistance, question set management, and user progress tracking.

## External Dependencies
- **Database**: PostgreSQL (Neon-backed)
- **Authentication**: AWS Cognito
- **AI/LLM**: OpenRouter (for AI chat functionality)
- **Frontend Frameworks**: React, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **ORM**: Drizzle
- **Markdown Processing**: unified/remark/rehype libraries