# Downtown Gardener

A plant-themed garden game for the browser. Sow, water, harvest, sell for **Kochu**, and grow your little patch of green in the city.

Open `index.html` through any static server (or GitHub Pages) - it needs `fetch`, so `file://` will not work.

## How to play
1. Pick a seed in the bar under the garden and tap empty soil to **sow**.
2. Pick the watering can and **water** the soil. Plants only grow while the soil is wet.
3. When a plant glows, tap it with the hand to **harvest**.
4. Sell harvests in the **Inventory**, buy seeds in the **Seed Shop** and upgrades in the **Tool Shop**.

## Plant rules
Plants live in `/sh/` (single harvest: the plant is gone after harvest) and `/mh/` (multi harvest: after harvest the plant resets to its `pgrowth` sprites and keeps producing).
Each plant is a folder named after the plant; its seed is called `<Plant>Seed`.

```
sh/Carrot/info.txt
sh/Carrot/ssprite1.svg ssprite2.svg ...   (seed growth, 16x16, shown during sgrowth)
sh/Carrot/psprite1.svg psprite2.svg ...   (plant growth, 16x16, shown during pgrowth; the last one is the ready-to-harvest sprite)
```

`info.txt` keys: `seedprice`, `stock` (1-100, % chance it is in the shop), `avgstock` (quantity, varies +-30%), `price` (per kg), `description` (Markdown), `mweight`, `maweight` (kg per harvest), `sgrowth`, `pgrowth` (seconds). Sprite time is divided evenly between the sprites of each stage, and a plant can have any number of them.

## Adding a plant
Create the folder with `info.txt` and sprites, then run `python3 tools/build_manifest.py` to refresh `plants.json`. `tools/gen_sprites.py` regenerates the starter plants and `img/kochu.svg`.
