import { createClient } from '@supabase/supabase-js';

const ADS_PASSWORD = process.env.ADS_STANDALONE_PASSWORD || 'BNBCALC';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  if (password !== ADS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid access code' });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(url, serviceKey);

  // Find the BNBCalc project owner
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('owner_id, id, name, domain, gsc_property, created_at, updated_at')
    .or('domain.ilike.%bnbcalc%,name.ilike.%bnbcalc%')
    .limit(1);

  if (projErr || !projects?.length) {
    return res.status(404).json({ error: 'BNBCalc project not found' });
  }

  const project = projects[0];
  const ownerId = project.owner_id;

  // Get the owner's email to sign them in
  const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(ownerId);
  if (userErr || !user?.email) {
    return res.status(500).json({ error: 'Could not resolve project owner' });
  }

  // Generate a magic link token for the owner (doesn't send email, just creates the token)
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });

  if (linkErr || !linkData) {
    return res.status(500).json({ error: 'Could not generate session' });
  }

  // Extract the token from the generated link and exchange it for a session
  const hashed_token = linkData.properties?.hashed_token;
  if (!hashed_token) {
    return res.status(500).json({ error: 'Could not generate access token' });
  }

  // Use the admin API to verify the OTP and get a session
  const { data: sessionData, error: sessionErr } = await supabase.auth.verifyOtp({
    token_hash: hashed_token,
    type: 'magiclink',
  });

  if (sessionErr || !sessionData?.session) {
    return res.status(500).json({ error: 'Could not create session' });
  }

  return res.status(200).json({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    project: {
      id: project.id,
      owner_id: project.owner_id,
      name: project.name,
      domain: project.domain,
      gsc_property: project.gsc_property,
      created_at: project.created_at,
      updated_at: project.updated_at,
      role: 'owner',
    },
  });
}
