FROM node:alpine

VOLUME [ "/game" ]


WORKDIR /modules
COPY . .
RUN npm install
RUN npm install -g .
WORKDIR /game

CMD [ "mvix" ]
