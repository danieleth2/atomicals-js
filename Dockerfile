###############################################################################
############## Stage 1: Build the code using a full node image ################
###############################################################################

FROM node:20.2-alpine AS build

WORKDIR /app

COPY . .

RUN yarn install --frozen-lockfile --network-timeout 1800000
RUN yarn build

###############################################################################
########## Stage 2: Copy over the built code to a leaner image ################
###############################################################################

FROM node:20.2-alpine

WORKDIR /app
RUN mkdir /app/wallets

COPY --from=build /app/.env /app/.env
COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules

ENTRYPOINT ["node", "dist/cli.js"]
