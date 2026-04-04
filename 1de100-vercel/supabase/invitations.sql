-- ─── INVITATIONS (pending email invites) ───
create table public.invitations (
  id uuid default uuid_generate_v4() primary key,
  inviter_id uuid references public.profiles(id) on delete cascade not null,
  invitee_email text not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz default now(),
  unique(inviter_id, invitee_email)
);

alter table public.invitations enable row level security;
create policy "Users can see their invitations" on public.invitations
  for select using (auth.uid() = inviter_id);
create policy "Users can create invitations" on public.invitations
  for insert with check (auth.uid() = inviter_id);

-- When a new user signs up, auto-accept any pending invitations to them
create or replace function public.handle_invitation_on_signup()
returns trigger as $$
declare
  inv record;
begin
  -- Find pending invitations for this email
  for inv in
    select * from public.invitations
    where invitee_email = new.email and status = 'pending'
  loop
    -- Create friendship (auto-accepted)
    insert into public.friendships (requester_id, addressee_id, status)
    values (inv.inviter_id, new.id, 'accepted')
    on conflict do nothing;

    -- Mark invitation as accepted
    update public.invitations set status = 'accepted' where id = inv.id;
  end loop;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_user_signup_check_invitations
  after insert on public.profiles
  for each row execute function public.handle_invitation_on_signup();
