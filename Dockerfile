FROM node:alpine

VOLUME [ "/game" ]

RUN npm i -g mvix

WORKDIR /game

CMD [ "mvix" ]
