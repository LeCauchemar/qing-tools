.mode line
select d.id, d.name, d.owner_id, ifnull(o.name,'') as owner_name,
       ifnull(d.revoked_at,'') as revoked, d.count, d.last_seen
  from sms_devices d
  left join sms_owners o on o.id = d.owner_id
 where d.token = 'WL_wr6RO_EKAoaBXSAus';
