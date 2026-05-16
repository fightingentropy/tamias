create virtual table if not exists customer_search_fts using fts5(
  customer_id unindexed,
  team_id unindexed,
  search_text
);

insert into customer_search_fts (customer_id, team_id, search_text)
select id, team_id, coalesce(search_text, '')
from customers
where not exists (
  select 1
  from customer_search_fts
  where customer_search_fts.customer_id = customers.id
    and customer_search_fts.team_id = customers.team_id
);
