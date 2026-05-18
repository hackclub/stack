# Stack YSWS

*Stack no-sense... Ship anyway!!*

<img width="1790" height="1276" alt="image" src="https://github.com/user-attachments/assets/d9d00dbc-f791-4349-a2f2-87fb58bb3faa" />

## Local development

### Database (Postgres)

```bash
docker compose up -d
```

Set in `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/stack
```

Tables are created automatically on server start (`ensureUsersTable`, projects, shop).

### App

```bash
npm install
npm run dev:full
```

- API: http://127.0.0.1:3000  
- UI (Vite): http://127.0.0.1:5173  

Copy `.env.example` → `.env` and add Hack Club Auth + Airtable keys for full login sync.
