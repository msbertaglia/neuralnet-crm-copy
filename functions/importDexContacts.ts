import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { parse } from 'npm:csv-parse/sync';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { csv_url } = await req.json();

    const response = await fetch(csv_url);
    const csvText = await response.text();

    const records = parse(csvText, { columns: true, skip_empty_lines: true, relax_quotes: true });

    const contacts = records.map(row => {
      const tags = [
        ...(row.dex_tags ? row.dex_tags.split(',').map(t => t.trim()).filter(Boolean) : []),
        ...(row.dex_groups ? row.dex_groups.split(',').map(g => g.trim()).filter(Boolean) : []),
      ];

      return {
        name: row.full_name || null,
        notes: row.description || null,
        birth_date: row.birthday || null,
        position: row.job_title || null,
        company: row.company || null,
        photo_url: row.image_url || null,
        starred: row.starred === 'true',
        linkedin_url: row.linkedin || null,
        twitter_url: row.twitter || null,
        instagram_url: row.instagram || null,
        facebook_url: row.facebook || null,
        telegram: row.telegram || null,
        website: row.website || null,
        whatsapp_message_link: row.whatsapp_message_link || null,
        status: row.is_archived === 'true' ? 'inativo' : 'prospect',
        phone: row.dex_phone || null,
        email: row.dex_email || null,
        address: row.dex_address || null,
        city: row.location || null,
        tags: tags.length > 0 ? tags : [],
        last_contact_date: row.whatsapp_last_message_at
          ? row.whatsapp_last_message_at.split('T')[0]
          : (row.last_reminder_at ? row.last_reminder_at.split('T')[0] : null),
        next_step_date: row.next_reminder_at ? row.next_reminder_at.split('T')[0] : null,
        visibility: 'publico',
      };
    }).filter(c => c.name && c.name.trim() !== '');

    const chunkSize = 50;
    let imported = 0;
    for (let i = 0; i < contacts.length; i += chunkSize) {
      const chunk = contacts.slice(i, i + chunkSize);
      await base44.asServiceRole.entities.Contact.bulkCreate(chunk);
      imported += chunk.length;
    }

    return Response.json({ success: true, imported });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});