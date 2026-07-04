# Koluj redesign update

Upraveno v tomto balíčku:

- sjednocený vzhled napříč stránkami přes `koluj-home`, `koluj-wide-frame`, `koluj-hero-card`, `koluj-card`,
- odstraněné staré horní logo/hlavičky ze stránek,
- doplněné `BackLink` tlačítko do hero sekcí, aby se šlo na PC vracet zpět,
- notifikace přesunuté ze samostatné stránky do vyskakovacího panelu `NotificationBell`,
- `/dashboard/notifications` přesměrovává zpět na dashboard,
- opravená mobilní komponenta `OfferSearchFilters`, aby prvky nepřetékaly,
- sjednocená mobilní navigace `BottomNav`,
- `InstallAppButton` podporuje `iconOnly`,
- zelená barva sjednocená na novou brand zelenou,
- přidané CSS pro notifikační panel a mapové clustery.

Poznámka:
Spustil jsem TypeScript kontrolu. V tomto sandboxu chybí `node_modules`, takže kontrola hlásí chybějící Next/React typy a balíčky; po opravě jedné JSX chyby už se neobjevila další syntaktická chyba z upravených souborů.
