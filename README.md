# mvix

A RPG Maker MV/MZ game player for Linux on your browser

## Usage

### Environment

- `DEBUG`: `boolean`
- `PORT`: `integer`

### Install globally

```shell
npm i -g mvix
# or
pnpm i -g mvix
# or
yarn add -g mvix
```

Then

```shell
# In RPG Maker MV/MZ games, the `www` folder should be existed
$ cd /path/to/your/game/folder/www

$ mvix
# or
$ DEBUG=true mvix
```

### Run by docker

```shell
docker run --rm -it --init \
  -v "/path/to/your/game/folder/www:/game" \
  -u 1000:1000 \
  -e PORT=3000 \
  -e DEBUG=true \
  --net host \
  ghcr.io/flandredaisuki/mvix
```
