# PuntIA 2.0

Asistente de crochet y amigurumi con frontend web y backend Express.

## Estructura

```text
PuntIA/
├── public/
│   └── index.html
├── server.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Ejecutar

1. Node.js 20+
2. `npm install`
3. Copia `.env.example` a `.env`
4. Configura `OPENAI_API_KEY`
5. Ejecuta `npm start`
6. Abre `http://localhost:3000`

La clave de API debe permanecer en el servidor. No subas `.env` ni una clave `sk-...` a GitHub.

## Variables

- `OPENAI_API_KEY`: clave de API de OpenAI.
- `OPENAI_MODEL`: modelo de OpenAI a utilizar (por defecto `gpt-6-luna`).
- `PORT`: puerto HTTP (por defecto `3000`).
