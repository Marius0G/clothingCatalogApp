# Referințe design — iterația „You tab" (19.07.2026)

Pozele originale (6 mockup-uri iPhone, stil „Editorial minimal") au venit de la Raducanu pe
WhatsApp pe 19.07.2026 și NU sunt încă în `design/Clothing-App.dc.html`. Rezumatul de mai
jos e sursa pentru implementarea din 22.07.2026 (implementarea reală păstrează pastila neagră
2c-B ca tab bar, decizie luată la grilling — pozele arătau un tab bar deschis cu etichete).
Mockup-ul „Add to…" a fost retrimis și e salvat aici ca `add-chooser.png`; din el s-au decupat
pozele de produs pentru carduri (`assets/images/add-chooser/{wishlist,wardrobe}.png`, crop-uri
36,860→315x285 și 390,838→311x307), iar tokens-urile rosetint/olivetint + roseline/oliveline
sunt eșantionate din el.

## add-chooser — „Add to…"
Titlu serif centrat „Add to…"; două carduri înalte una lângă alta: stânga Wishlist (fundal
roz pal, inimă contur roșu-cărămiziu, titlu „Wishlist", descriere „Save items you love and
want to buy later.", poză produs jos), dreapta Wardrobe (fundal oliv pal, umeraș oliv,
„Add items you own to your wardrobe.", poză jachetă jos); X rotund alb centrat jos.

## you-hub — „You"
Titlu „You" centrat; avatar mare rotund cu creion de editare (implementat: inițiale, fără
editare); numele serif sub avatar (FĂRĂ subtitlu — cerință explicită); 4 carduri: Preferences
(sparkles, „Manage your style preferences, favorite brands and clothing sizes."), Collections
(folder, „Organize your wardrobe with collections."), Support (balon chat, „Get help, find
answers and contact us."), Settings (rotiță, „Manage your account, notifications and premium
plan.") — fiecare cu icon-în-cerc, titlu, descriere, chevron.

## preferences
Back stânga sus, titlu serif „Preferences" + subtitlu „Update your style preferences to get
better recommendations."; carduri-secțiune cu „Edit" dreapta: Preferred Styles (chips cu
iconițe), Favorite Colors (7 buline: negru, bleumarin, gri, bej, alb, oliv, maro), Favorite
Brands (chips: COS, Massimo Dutti, Uniqlo, Zara, Arket, New Balance), Clothing Sizes (rânduri
Tops M / Bottoms 32 / Shoes 42 cu chevron — DOAR primele 3, fără Outerwear, cerință
explicită), Additional Style Notes (text liber). Lista canonică de 20 de stiluri e în
`StyleTagSchema` (shared/types).

## collections
Back + titlu „Collections" + „+" dreapta sus; subtitlu „Organize your wardrobe with
collections that fit your life."; carduri: copertă pătrată stânga (= PRIMA piesă adăugată în
colecție), nume, „N items", 4 buline de culori (nice-to-have aprobat), chevron; jos card cu
bordură întreruptă „New Collection — Create a collection to organize your items.".

## support
Back + titlu „Support" + subtitlu „We're here to help you with anything you need."; rânduri:
Help Center (carte, „Find answers to common questions and how-to guides."), Contact Us
(plic, „Send us a message and we'll get back to you."), Send Feedback (balon chat, „Share
your thoughts and help us improve."); jos card mare cu inimă, „We value your feedback",
body + buton negru „Send Feedback".

## settings
Back + titlu „Settings" + subtitlu; secțiuni cu label uppercase: ACCOUNT (Account
Information, Privacy*, Security, Premium cu badge verde „Active"*), PREFERENCES
(Notifications, Language), ABOUT (About the App, Terms & Policies), „Version 1.2.0" jos.
*În implementare: Privacy omis (delete account acoperă datele), Premium doar vizual
„În curând" (v1 nu are paywall — decizie de la grilling).
