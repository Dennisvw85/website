# website

Mijn persoonlijke site, statische HTML op Azure Static Web Apps (Free-tier).

- `src/` is de site. Geen build-stap.
- Elke push naar `main` deployt via `.github/workflows/deploy.yml`.
- Het deployment-token staat als secret `AZURE_STATIC_WEB_APPS_API_TOKEN` in deze repo.

## CV-agent

- De chat in de hero praat met een Foundry-agent via `POST /api/chat`.
- De API is geen onderdeel van deze repo: Static Web Apps stuurt `/api` door naar de Function App uit [cv-agent](https://github.com/Dennisvw85/cv-agent) (linked backend, Standard-plan).
- De site staat achter een wachtwoord. Plan, wachtwoord en koppeling worden beheerd vanuit `cv-agent/infra/website.bicep`.

## Later

- Eigen domein koppelen.
