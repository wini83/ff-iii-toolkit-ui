cmt:
	npm run commit
dev:
	npm run dev
schema:
	npx openapi-typescript http://localhost:8000/api/openapi.json -o src/lib/api/schema.ts

