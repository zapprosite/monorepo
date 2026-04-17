# SECRETS Results

## Task

Verificar que .env existe e tem GITEA*TOKEN, GITEA_INSTANCE_URL. grep -c ^GITEA* .env

## Results

- `.env` existe em `/srv/monorepo/.env`
- `GITEA_INSTANCE_URL=https://git.zappro.site` — presente (linha 19)
- `GITEA_TOKEN=50fca86d6a9ee37871f3a0cc3fa4efc7fc7cfb91` — presente (linha 21)

## Status

PASS
