create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('zemin-settle-listings', '* * * * *', $$select pilot.settle_due()$$);
