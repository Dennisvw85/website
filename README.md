# website

Mijn persoonlijke site, statische HTML op Azure Static Web Apps (Free-tier).

- `src/` is de site. Geen build-stap.
- Elke push naar `main` deployt via `.github/workflows/deploy.yml`.
- Het deployment-token staat als secret `AZURE_STATIC_WEB_APPS_API_TOKEN` in deze repo.

## Later

- Eigen domein koppelen.
- Chatbot "vraag mijn CV" op een Foundry-agent, via `api/`, met een rate limit.
