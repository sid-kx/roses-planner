# 🌹 The Rose Room Planner

A private order-planning dashboard for **Roses by Aikam**.

The planner is hosted on:

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
