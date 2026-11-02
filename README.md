# BookNook Server

REST API for **BookNook**, a small online library. Built with Express and MongoDB.

Server Link: https://booknook-server-five.vercel.app/
Client repository: https://github.com/Bijoy34-CSE/booknook-client
## Features

- 8 REST routes for books and borrows
- JWT protected routes (token comes from the Next.js client)
- Atomic copy counting with `$inc` so the last copy cannot be taken twice
- Unique index that stops a user from borrowing the same book twice
- Owner-only edit and delete for books

## API

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/books` | Public | All books. Supports `?limit=`, `?category=`, `?search=`, `?mine=true` (needs token) |
| GET | `/books/:id` | Token | One book |
| POST | `/books` | Token | Add a book |
| PATCH | `/books/:id` | Token, owner | Update a book |
| DELETE | `/books/:id` | Token, owner | Delete a book and its borrow records |
| POST | `/borrows` | Token | Borrow a book (`{ "bookId": "..." }`) |
| GET | `/borrows` | Token | Borrows of the logged in user |
| DELETE | `/borrows/:id` | Token, owner | Return a book |

Send the token as `Authorization: Bearer <token>`.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values
3. `npm run dev` (runs on port 5000)

`JWT_SECRET` must be the same value as in the client `.env.local`.

## Tech

Node.js, Express, MongoDB, jsonwebtoken, cors, dotenv
