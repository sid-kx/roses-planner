# 🌹 The Rose Room Planner

A private order-planning dashboard for **Roses by Aikam**.

The planner is hosted on:

```txt

rosesbyaikam.com
This domain is used for the internal planner only. The public business website is hosted separately.

⸻

Features

* Secure email/password login using Supabase Auth
* Protected planner dashboard
* Monthly order calendar
* Add and edit rose bouquet orders
* Track client name, date, rose count, pickup/delivery, details, total price, paid amount, and amount due
* View upcoming and past orders
* Save order data online using Supabase
* Mobile-friendly pink glassmorphism design

⸻

Tech Stack

* HTML
* CSS
* Vanilla JavaScript
* Supabase Auth
* Supabase PostgreSQL
* GitHub Pages / static hosting

No React, npm, or build tools are required.

⸻

Project Structure
the-rose-room-planner/
├── index.html
├── planner.html
├── CNAME
├── README.md
├── css/
│   └── style.css
└── js/
    ├── supabase.js
    └── script.js

⸻

Main Files

index.html

Login page for the planner.

planner.html

Protected dashboard with the order calendar, order tables, logout button, and add/edit order modal.

css/style.css

Main styling file for the pink glassmorphism design and mobile layout.

js/supabase.js

Creates the Supabase client using the project URL and anon public key.

Never place the Supabase service_role key in this file.

js/script.js

Handles login, logout, auth checking, order saving, order loading, calendar rendering, and modal actions.

⸻

Supabase Backend

Orders are saved in a Supabase table called orders.

Main fields:

* id
* user_id
* client
* date
* size
* type
* details
* total
* paid
* due
* created_at
* updated_at

Each order is connected to the logged-in user through user_id.

Row Level Security is enabled so users can only view, add, update, or delete their own orders.

