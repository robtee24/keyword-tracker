import { getAccessTokenFromRequest } from '../../_config.js';

export default async function handler(req, res) {
  try {
    const accessToken = getAccessTokenFromRequest(req);

    if (!accessToken) {
      return res.status(200).json({
        authorized: false,
        message: 'No access token provided. Please sign in with Google.',
      });
    }

    // Validate the token by making a lightweight API call
    const response = await fetch(
      'https://www.googleapis.com/webmasters/v3/sites',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (response.ok) {
      return res.status(200).json({
        authorized: true,
        message: 'Google Search Console access is authorized.',
      });
    }

    return res.status(200).json({
      authorized: false,
      message: 'Access token is invalid or expired. Please sign in again.',
    });
  } catch (error) {
    console.error('Error checking OAuth status:', error);
    return res.status(200).json({
      authorized: false,
      message: 'Error checking authorization status.',
      error: error.message,
    });
  }
}
