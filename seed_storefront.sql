-- Seed Rixey Picks storefront from StoreFront.csv
-- Run AFTER add_storefront_table.sql
-- Safe to re-run: uses ON CONFLICT DO NOTHING

INSERT INTO storefront_items (product_type, category, pick_name, pick_type, description, affiliate_link, image_url, color_options) VALUES

('Disposable Cocktail Glasses','Partyware & Serving','Plastic Coupes (Speakeasy Style)','Best Splurge','That chic coupe silhouette—Instant Great Gatsby vibes, zero glass risk.','https://amzn.to/3Kn9OUE','https://m.media-amazon.com/images/I/71R1wWH1OdL._AC_SX679_.jpg','Clear/Mixed colors - retro, muted, bright options'),

('Disposable Champagne Flutes','Partyware & Serving','Clear Bulk Flutes (50–100 pack)','Best Save','Simple, sturdy, and budget-wise for large guest counts—no one will notice after the toast.','https://amzn.to/4pFwcsr','https://m.media-amazon.com/images/I/71SXlEBKbKL._SX522_.jpg','Clear/Gold Glitter'),

('Glow Sticks / LED Wands','Guest Experience','Custom Printed LED Wands','Best Custom','Personalized with names/date — a fun touch for the party crowd.','https://amzn.to/42QL3qa','https://m.media-amazon.com/images/I/61kWmdC4+sL._AC_SX679_.jpg',NULL),

('Disposable Wine Glasses','Partyware & Serving','Stemless Wine Cups (Bulk)','Best Save','Affordable stemless cups that stack neatly at bars and beverage tables.','https://amzn.to/46BEDMF','https://m.media-amazon.com/images/I/61IpnmyNx4L._AC_SX679_.jpg','Gold/Silver'),

('Cake Cutting Sets (knife & server)','Partyware & Serving','Pearl-Handled Server','Best Seasonal (Spring/Summer)','Soft, pearly handles feel fresh and romantic in spring light.','https://amzn.to/46U2ska','https://m.media-amazon.com/images/I/61FuZzfS7PL._AC_SX679_.jpg','Ivory/Blue/Black/Gold/Green'),

('Disposable Plates (plastic/bamboo/compostable)','Partyware & Serving','Floral Rim Plates','Best Seasonal (Spring/Summer)','Whimsical floral detail that suits garden receptions and tents.','https://amzn.to/46Ckjuz','https://m.media-amazon.com/images/I/91q8wEcFRSL._AC_SX679_.jpg','Blue/Red/Grey/Burgundy'),

('Disposable Wine Glasses','Partyware & Serving','Crystal-Style Stemmed Wine Cups','Best Splurge','Cut-crystal look with a real-stem silhouette—elegant and sturdy.','https://amzn.to/480hh5Z','https://m.media-amazon.com/images/I/71dBujjWn7L._AC_SX679_.jpg','Black/Blue/Gold/Green/Sage'),

('Fans or Parasols','Guest Experience','Floral Print Fans','Best Seasonal (Spring/Summer)','Chinese floral prints that echo bouquets and décor.','https://amzn.to/4mCANcq','https://m.media-amazon.com/images/I/81oEUMI5h5L._AC_SX679_.jpg',NULL),

('Confetti Toss','Guest Experience','Confetti Cones','Best Practical','Combine with the Paper Confetti for a win. Must be assembled.','https://amzn.to/3KmjSNB','https://m.media-amazon.com/images/I/710IuXxrUjS._AC_SX466_.jpg',NULL),

('Welcome Bag Fillers','Guest Experience','Mini Water Bottles (Bulk)','Best Save','Affordable hydration essential — keeps everyone comfortable.','https://amzn.to/48BtL41','https://m.media-amazon.com/images/I/61L5E7-LRuL._SY741_.jpg',NULL),

('Guest Books','Guest Experience','Floral Print Guest Book','Best Seasonal (Spring/Summer)','Bright floral cover — fresh and playful for warm-weather weddings.','https://amzn.to/3IqNNUp','https://m.media-amazon.com/images/I/81OjrjPOp+L._AC_SX679_.jpg','Green/White/Blue/Blush'),

('Disposable Cutlery (gold/silver/eco)','Partyware & Serving','Compostable Birchwood Sets','Best Practical','Sustainable sets that won''t bend under hearty reception meals.','https://amzn.to/3Km5pRQ','https://m.media-amazon.com/images/I/71tX0wJx1KL._AC_SX679_.jpg',NULL),

('Welcome Bags','Guest Experience','Floral Welcome Bags','Best Seasonal (Spring/Summer)','Bright prints and colors — fun surprise for warm-weather weddings.','https://amzn.to/3KlNPxt','https://m.media-amazon.com/images/I/71xAKY8jnoL._AC_SX466_.jpg',NULL),

('Disposable Champagne Flutes','Partyware & Serving','Pastel Flutes','Best Seasonal (Spring/Summer)','Soft blush or sage that match garden-party palettes beautifully.','https://amzn.to/46EtZEW','https://m.media-amazon.com/images/I/716qIpyIQgL._AC_SX679_.jpg','Pink/Clear'),

('Cupcake & Dessert Display Towers','Partyware & Serving','Gold Dessert Set','Best Save','A 5 piece gold display set for all your dessert needs.','https://amzn.to/4nNHsBl','https://m.media-amazon.com/images/I/81tmfdRf95L._AC_SX679_.jpg',NULL),

('Disposable Wine Glasses','Partyware & Serving','Ribbed Green Wine Glasses','Best Seasonal (Spring/Summer)','Ribbed and lightly colored — a fresh modern touch.','https://amzn.to/42aj1FU','https://m.media-amazon.com/images/I/713zRSFi7VL._AC_SX679_.jpg','Green/Blue/Pink/Clear/Purple/Gold'),

('Glow Sticks / LED Wands','Guest Experience','LED Wands','Best Practical','LED wands to light up the dancefloor.','https://www.amazon.com/s?k=glow+sticks+wedding','https://m.media-amazon.com/images/I/81tWZ7c6UKL._AC_SX679_PIbundle-152,TopRight,0,0_SH20_.jpg',NULL),

('Pens & Markers for Guest Books','Guest Experience','Metallic Gel Pens','Best Seasonal (Fall/Winter)','Shimmery inks in silver and gold sparkle against dark pages.','https://amzn.to/4nI4Pw0','https://m.media-amazon.com/images/I/81Tcs3orFRL._AC_SX679_.jpg',NULL),

('Disposable Plates (plastic/bamboo/compostable)','Partyware & Serving','Bamboo or Palm Leaf Plates','Best Practical','Sturdy, eco-friendly plates that hold up to barbecue and buffets.','https://amzn.to/3IERtBT','https://m.media-amazon.com/images/I/81qcMABXmzL._AC_SX679_.jpg',NULL),

('Disposable Cocktail Glasses','Partyware & Serving','Pink Coupe Glasses','Best Seasonal (Spring/Summer)','Vintage feel, in blush pink. Requires putting together.','https://amzn.to/4gH81WF','https://m.media-amazon.com/images/I/71xVpxNcJ+L._AC_SX679_.jpg','Pink/Blue/Clear/Green'),

('Cake Stands (tiered/acrylic/glass)','Partyware & Serving','Ornate Stand for Cutting Cake','Best Splurge','An organic design elevates even the most simple cutting cake.','https://www.amazon.com/s?k=white+acrylic+cake+stand','https://m.media-amazon.com/images/I/81LinVZldyL._AC_SX679_.jpg',NULL),

('Disposable Plates (plastic/bamboo/compostable)','Partyware & Serving','Faux Porcelain Plastic Plates (Gold Rim)','Best Splurge','Polished ''china'' look without rentals—guests will do double-takes.','https://amzn.to/3VwEaqa','https://m.media-amazon.com/images/I/71NfevO6-BL._AC_SY879_.jpg','Gold/Pink/Clear/Silver/Red'),

('Disposable Cutlery (gold/silver/eco)','Partyware & Serving','Classic Gold Cutlery (Bulk)','Best Save','No-frills, budget-friendly cutlery that simply gets it done.','https://amzn.to/481tibk','https://m.media-amazon.com/images/I/81BHD0jXwSL._AC_SX679_.jpg','Gold/Silver'),

('Disposable Champagne Flutes','Partyware & Serving','Glitter Gold Flutes','Best Seasonal (Fall/Winter)','Sparkles in the ballroom candlelight.','https://amzn.to/42cULD8','https://m.media-amazon.com/images/I/81HDt17Hb-L._AC_SX679_.jpg','Gold/Blue/Pink/Purple'),

('Votive Candle Holders','Décor & Lighting','Metallic Mercury Glass Holders','Best Seasonal (Fall/Winter)','Durable and endlessly reusable—planner favorite.','https://amzn.to/46EqBtE','https://m.media-amazon.com/images/I/718DSYH8G4L._AC_SX679_.jpg',NULL),

('Guest Books','Guest Experience','Velvet Guest Book','Best Seasonal (Fall/Winter)','Plush velvet cover in deep jewel tones — perfect for cozy fall or winter weddings.','https://amzn.to/4pLQOQ4','https://m.media-amazon.com/images/I/81StIzVOLOL._AC_SX679_.jpg',NULL),

('Glow Sticks / LED Wands','Guest Experience','Bulk Glow Stick Bracelets','Best Save','Cheap and cheerful glow — easy to hand out by the dozen.','https://amzn.to/42M3yMv','https://m.media-amazon.com/images/I/812WhppfnCL._AC_SX466_.jpg',NULL),

('Cupcake & Dessert Display Towers','Partyware & Serving','Dessert Cart','Best Splurge','Why have a cupcake tower when you can have a cupcake cart.','https://amzn.to/42RgL6H','https://m.media-amazon.com/images/I/71ACffEm-8L._AC_SX679_.jpg',NULL),

('Cake Stands (tiered/acrylic/glass)','Partyware & Serving','Antique Bronze Pedestal','Best Seasonal (Fall/Winter)','Old-world charm that pairs beautifully with candlelight and evergreens.','https://amzn.to/4nKQdMp','https://m.media-amazon.com/images/I/71LFO-YYd+L._AC_SX679_.jpg',NULL),

('Wedding Favors','Guest Experience','Mini Hot Cocoa Kits','Best Seasonal (Fall/Winter)','Sweet hot chocolate jars — cozy favors for cold weather weddings.','https://amzn.to/4mDZvsX','https://m.media-amazon.com/images/I/813o1lmYgHL._SX679_.jpg',NULL),

('Disposable Cocktail Glasses','Partyware & Serving','Gold-Rim Rocks Cups','Best Seasonal (Fall/Winter)','Old Fashioneds look extra dapper with a metallic rim in cooler months.','https://amzn.to/4nF7Iyp','https://m.media-amazon.com/images/I/61IpnmyNx4L._AC_SX679_.jpg','Gold/Silver'),

('Welcome Bags','Guest Experience','Gold Welcome Bags','Best Seasonal (Fall/Winter)','Filled with cocoa, mittens, and hand warmers — winter wedding win.','https://amzn.to/4nn9bsZ','https://m.media-amazon.com/images/I/81nZ0JydEqL._AC_SX466_.jpg',NULL),

('Guest Books','Guest Experience','Luxury Leather Guest Book','Best Splurge','A keepsake-quality leather guest book embossed with gold foil — timeless and elegant.','https://amzn.to/3KsER1j','https://m.media-amazon.com/images/I/815vnql3AJL._AC_SX679_.jpg','Green/Navy/White/Burgundy/Brown/Black/Ivory'),

('Tealights','Décor & Lighting','White Unscented Bulk Tealights','Best Save','Affordable, unscented, long-burning — perfect for mass décor.','https://amzn.to/3KEnxq6','https://m.media-amazon.com/images/I/71cJCcq3gHL._AC_SX679_PIbundle-48,TopRight,0,0_SH20_.jpg',NULL),

('Cupcake & Dessert Display Towers','Partyware & Serving','3 Tier Wood Stand','Best Practical','Packs away and can be repurposed for lots of different events.','https://amzn.to/3IkrH62','https://m.media-amazon.com/images/I/71OW+FJEjhL._AC_SY300_SX300_QL70_FMwebp_.jpg',NULL),

('Personalized Favor Packaging','Guest Experience','Organza Drawstring Bags','Best Practical','Lightweight and reusable — ideal for candy or trinkets.','https://amzn.to/48jVLt9','https://m.media-amazon.com/images/I/71ifCjm5JDL._AC_SX466_.jpg','All the colors'),

('Welcome Bag Fillers','Guest Experience','Mini Hand Warmers','Best Seasonal (Fall/Winter)','Pocket warmers — thoughtful extra for cold-weather weddings.','https://amzn.to/42NeJV6','https://m.media-amazon.com/images/I/81LIVrFpRqL._AC_SX679_.jpg',NULL),

('Disposable Plates (plastic/bamboo/compostable)','Partyware & Serving','Matte Black or Plum Plates','Best Seasonal (Fall/Winter)','Moody, modern tones that feel luxe by candlelight.','https://amzn.to/4mxPFsc','https://m.media-amazon.com/images/I/717f+WhiEmL._AC_SX679_.jpg','Matte Black/Frosted Blue/Purple/Pink/Green/Gold'),

('Send Off Ideas','Guest Experience','Fiber Optic Wands','Best Save','Fun on the dancefloor and for a safe exit photo.','https://amzn.to/3Iuwbae','https://m.media-amazon.com/images/I/81+kjuD6MzL._AC_SX679_.jpg',NULL),

('Pens & Markers for Guest Books','Guest Experience','Blush Blossom Pen Set','Best Seasonal (Spring/Summer)','Soft flower and subtle silver pen to add to the florals.','https://amzn.to/3W8W4PW','https://m.media-amazon.com/images/I/51+gbMyVi0L._AC_SX679_.jpg','Black/Red/Green'),

('Disposable Napkins (plain/printed/custom)','Partyware & Serving','Gold Floral Napkin','Best Seasonal (Fall/Winter)','Clean with a little gold embossing for glam.','https://amzn.to/4gDQ7Ux','https://m.media-amazon.com/images/I/71R990L6d+L._AC_SX679_.jpg','Gold/Silver/Other Fall Patterns'),

('Pens & Markers for Guest Books','Guest Experience','Fine-Tip Permanent Markers','Best Practical','No smudging on glossy pages — planner-approved practical choice.','https://amzn.to/46WAZ1m','https://m.media-amazon.com/images/I/61Sr50VU3dL._AC_SX679_.jpg',NULL),

('Disposable Napkins (plain/printed/custom)','Partyware & Serving','Floral Print Napkins','Best Seasonal (Spring/Summer)','Sweet botanicals that echo garden bouquets and pastel palettes.','https://amzn.to/4nOmges','https://m.media-amazon.com/images/I/91JtLLsw1uL._AC_SX679_.jpg','Green/Pink'),

('Disposable Cutlery (gold/silver/eco)','Partyware & Serving','Silver-Look Flatware Set','Best Seasonal (Fall/Winter)','Cool-toned silver harmonizes with winter whites and evergreens.','https://amzn.to/3IvomBa','https://m.media-amazon.com/images/I/81tFTgVeDiL._AC_SX679_.jpg',NULL),

('Cake Cutting Sets (knife & server)','Partyware & Serving','Wood-Handled Rustic Server','Best Seasonal (Fall/Winter)','Warm wood grips suit cozy autumn halls and winter ballrooms.','https://amzn.to/4nR0eb7','https://m.media-amazon.com/images/I/61zGNJ71UtL._AC_SX679_.jpg','Dark wood/Light wood'),

('Cupcake & Dessert Display Towers','Partyware & Serving','Spsyrine Serving Tray','Best Seasonal (Fall/Winter)','Serving trays in a variety of styles for serving finger desserts.','https://amzn.to/46EZUVM','https://m.media-amazon.com/images/I/71xCYly+8GL._AC_SX679_.jpg','Green/Blue/Yellow/Red/Black'),

('Welcome Bags','Guest Experience','Burlap Fabric Bags','Best Practical','Reusable burlap bags that hold snacks, water, and essentials.','https://amzn.to/4nUqeCx','https://m.media-amazon.com/images/I/81X83ulTOWL._AC_SX679_.jpg','Green/Black/Beige/Pink'),

('Confetti Toss','Guest Experience','Paper Confetti (Bulk)','Best Save','Rice paper that floats beautifully for photos.','https://amzn.to/4niWEXf','https://m.media-amazon.com/images/I/51eHU9PaNdL._AC_SX466_.jpg','White/Blue/Green/Pink (foil options not biodegradable)'),

('Disposable Champagne Flutes','Partyware & Serving','Crystal-Cut Gold-Rim Flutes','Best Splurge','Crystal-look plastic — photographs like glass without the stress.','https://amzn.to/428goob','https://m.media-amazon.com/images/I/81aMZZo36gL._AC_SY300_SX300_QL70_FMwebp_.jpg','Blue/Pink/Red/Gold/Blush/Green'),

('Send Off Ideas','Guest Experience','Fairy Wands for Night or Day','Best Seasonal (Spring/Summer)','When the sun sets later these can help with photos in light or at night.','https://www.amazon.com/s?k=color+sparklers+wedding','https://m.media-amazon.com/images/I/81Bcauan5+L._AC_SX466_.jpg',NULL),

('Fans or Parasols','Guest Experience','Parasols','Best Splurge','Romantic parasols that feel straight out of a countryside fairytale.','https://www.etsy.com/search?q=luxury+lace+parasols+wedding','https://m.media-amazon.com/images/I/71eiGqBIn0L._AC_SX679_.jpg','White/Blue/Pink/Multi'),

('Cake Cutting Sets (knife & server)','Partyware & Serving','Gold-Plated Knife & Server','Best Splurge','Rose quartz handles — a beautiful keepsake for years to come.','https://amzn.to/4nmz6kg','https://m.media-amazon.com/images/I/515xPZOyhPL._AC_SX679_.jpg',NULL),

('Cake Stands (tiered/acrylic/glass)','Partyware & Serving','Gold and Glass Large Cake Stand','Best Splurge','A clean modern look that allows the cake to take pride of place.','https://amzn.to/4mvE7Wx','https://m.media-amazon.com/images/I/61S-YHcjLOL._AC_SX679_.jpg',NULL),

('Cupcake & Dessert Display Towers','Partyware & Serving','Rustic Dessert Tower With Swing','Best Seasonal (Spring/Summer)','Dress with silk blooms for a garden-party moment.','https://amzn.to/48AfsNc','https://m.media-amazon.com/images/I/71WDrIt85SL._AC_SX679_.jpg','Light wood/Dark Wood'),

('Disposable Champagne Flutes','Partyware & Serving','Shatterproof Stemless Flutes','Best Practical','Stemless = fewer tip-overs on the lawn; shatterproof keeps clean-up easy.','https://amzn.to/4pDTwa7','https://m.media-amazon.com/images/I/81dVlwumbyL._AC_SX679_.jpg','Gold/Silver'),

('Wedding Favors','Guest Experience','Mini-Tape Measures','Best Practical','These will be appreciated and used more than almost anything else.','https://amzn.to/4nq5xP0','https://m.media-amazon.com/images/I/81fuMS6hcVL._SX522_.jpg',NULL),

('Fans or Parasols','Guest Experience','Bamboo Hand Fans','Best Practical','Durable and eco-friendly fans that last through the whole ceremony.','https://amzn.to/46WyKLm','https://m.media-amazon.com/images/I/A1OxtJ1nQYL._AC_SX679_.jpg',NULL),

('Disposable Cutlery (gold/silver/eco)','Partyware & Serving','Heavyweight Gold-Look Cutlery','Best Splurge','Metallic-look flatware that elevates place settings instantly.','https://amzn.to/42ahPm3','https://m.media-amazon.com/images/I/812MsImIJAL._AC_SX679_.jpg','Green/White/Gold/Blue/Pink/Sage/Black/Red/Navy'),

('Send Off Ideas','Guest Experience','Sparkly Balloons','Best Seasonal (Fall/Winter)','Rich golden glow — magical against winter skies and works well all night for décor and exits.','https://amzn.to/3VxgTEy','https://m.media-amazon.com/images/I/81mT21pcoQL._AC_SX466_.jpg',NULL),

('Cake Stands (tiered/acrylic/glass)','Partyware & Serving','Milk Glass Jadeite Stand','Best Seasonal (Spring/Summer)','A splurge but a stunning addition to a spring floral cake.','https://amzn.to/46FQuJQ','https://m.media-amazon.com/images/I/41MAdtGvKCL._AC_SX679_.jpg',NULL),

('Confetti Toss','Guest Experience','Confetti Cannons','Best Seasonal (Spring/Summer)','One pack is more than enough!','https://amzn.to/46obt55','https://m.media-amazon.com/images/I/71rqFBKOixL._AC_SX466_.jpg','White/Pink/Multi (foil not biodegradable)'),

('Cake Stands (tiered/acrylic/glass)','Partyware & Serving','Ceramic Pedestal Stand','Best Practical','Easy to store, repurpose, and comes in a variety of colors (10 inch).','https://amzn.to/46Wkz96','https://m.media-amazon.com/images/I/819C7plkUYL._AC_SX679_.jpg','Blue/Pink/White/Black'),

('Welcome Bag Fillers','Guest Experience','Liquid IV Mix Packets','Best Seasonal (Spring/Summer)','Bright, refreshing, and fun for warm-weather weddings.','https://amzn.to/46Fl5Hk','https://m.media-amazon.com/images/I/81-gPx8qMBL._AC_SX466_PIbundle-30,TopRight,0,0_SH20_.jpg',NULL),

('Wedding Favors','Guest Experience','Mini-Soaps','Best Seasonal (Spring/Summer)','Mini soaps with dried flowers and a thank you note.','https://amzn.to/4pHSSsc','https://m.media-amazon.com/images/I/81uw+xeN84L._AC_SX679_.jpg','Pink/Blue/Neutral'),

('Glow Sticks / LED Wands','Guest Experience','LED Foam Wands','Best Splurge','Big glowing foam sticks — a dancefloor spectacle.','https://amzn.to/3VB4pMg','https://m.media-amazon.com/images/I/712BLcEQgXL._AC_SX466_.jpg',NULL),

('Welcome Bag Fillers','Guest Experience','Travel-Size Toiletries','Best Practical','Practical basics like pain relievers, antacids, and more.','https://amzn.to/42cCdCX','https://m.media-amazon.com/images/I/710a2A7m7WL._AC_SX679_.jpg',NULL),

('Cake Cutting Sets (knife & server)','Partyware & Serving','Simple Stainless Steel Set','Best Save','Classic, dependable, and easy to keep for anniversaries.','https://amzn.to/3IAc2j1','https://m.media-amazon.com/images/I/81dlqDzWs3L._AC_SY879_.jpg','Gold/Black/Silver/Rose Gold/Multi'),

('Votive Candle Holders','Décor & Lighting','Crystal Glass Votives','Best Splurge','Elegant faceted crystal holders that sparkle under candlelight.','https://amzn.to/3Wahdcs','https://m.media-amazon.com/images/I/91YGSDvINdL._AC_SX679_.jpg','Gold/Brown/Blue/Clear/Green/Pink'),

('Disposable Cutlery (gold/silver/eco)','Partyware & Serving','Blush-Gold Flatware Set','Best Seasonal (Spring/Summer)','Soft rose-gold sings with blush palettes and garden florals.','https://amzn.to/46nyrt1','https://m.media-amazon.com/images/I/81Y66uiDP0L._AC_SX679_.jpg','Pink/Green'),

('Guest Books','Guest Experience','Classic Ivory Guest Book','Best Save','Simple, budget-friendly guest book with embossed cover.','https://amzn.to/3Is2Flt','https://m.media-amazon.com/images/I/81QThVOZfOL._AC_SX679_.jpg',NULL),

('Fans or Parasols','Guest Experience','Paper Fans (Bulk)','Best Save','Budget-friendly packs — essential for hot outdoor ceremonies.','https://amzn.to/3VVjR65','https://m.media-amazon.com/images/I/71gLBx8m6aL._AC_SX679_.jpg',NULL),

('Disposable Napkins (plain/printed/custom)','Partyware & Serving','Linen-Feel Dinner Napkins','Best Splurge','Plush, linen-feel napkins that pass the touch test with flying colors.','https://amzn.to/3IDHQ6y','https://m.media-amazon.com/images/I/61PxhMToUQL._AC_SX679_.jpg',NULL),

('Disposable Wine Glasses','Partyware & Serving','Gold-Rim Stemmed Cups','Best Seasonal (Fall/Winter)','A touch of metallic warmth that pairs beautifully with candlelight.','https://amzn.to/3IBFKE8','https://m.media-amazon.com/images/I/71m0Sqbng2L._AC_SX679_.jpg','Gold Rim, Pink, Red, Blue, Champagne options too'),

('Pens & Markers for Guest Books','Guest Experience','Gold Rollerball Pen','Best Splurge','24k gold finish and nearly perfect reviews.','https://amzn.to/4gJbZ0P','https://m.media-amazon.com/images/I/91e1Li5V0FL._AC_SX679_.jpg',NULL),

('Disposable Plates (plastic/bamboo/compostable)','Partyware & Serving','Heavy-Duty White Plates (Bulk)','Best Save','Classic and clean—stack high and serve everyone affordably.','https://amzn.to/4nN2cJr','https://m.media-amazon.com/images/I/71U3MkkNrYL._AC_SX679_.jpg','Silver/Gold/Black')

ON CONFLICT DO NOTHING;
