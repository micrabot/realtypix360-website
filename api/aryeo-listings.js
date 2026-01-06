// Vercel Serverless Function to fetch listings from Aryeo API
// This keeps your API key secure on the server side

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Get query parameters
    const { page = 1, per_page = 50, search = '' } = req.query;

    // Build Aryeo API URL
    const baseUrl = 'https://api.aryeo.com/v1/listings';
    const params = new URLSearchParams({
      page: page,
      per_page: per_page,
      // Include related data we need for the portfolio
      include: 'images,property_website,floor_plans,interactive_content,address'
    });

    // Add search filter if provided
    if (search) {
      params.append('filter[search]', search);
    }

    const apiUrl = `${baseUrl}?${params.toString()}`;

    // Fetch from Aryeo API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.ARYEO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Aryeo API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform the data to what our frontend needs
    const transformedData = {
      listings: data.data.map(listing => ({
        id: listing.id,
        address: listing.address ? {
          street: listing.address.address_line_1,
          city: listing.address.city,
          state: listing.address.state_or_province,
          zip: listing.address.postal_code,
          full: listing.address.address_line_1 + ', ' + listing.address.city + ', ' + listing.address.state_or_province
        } : null,
        thumbnail: listing.images && listing.images.length > 0 
          ? listing.images[0].thumbnail_url || listing.images[0].url 
          : null,
        propertyWebsiteUrl: listing.property_website?.branded_url || listing.property_website?.unbranded_url,
        imageCount: listing.images ? listing.images.length : 0,
        has3DTour: listing.interactive_content && listing.interactive_content.length > 0,
        hasFloorPlan: listing.floor_plans && listing.floor_plans.length > 0,
        propertyType: listing.property_type || 'Residential',
        createdAt: listing.created_at
      })),
      pagination: {
        total: data.meta?.total || 0,
        perPage: data.meta?.per_page || 50,
        currentPage: data.meta?.current_page || 1,
        lastPage: data.meta?.last_page || 1
      }
    };

    res.status(200).json(transformedData);

  } catch (error) {
    console.error('Error fetching Aryeo listings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch listings',
      message: error.message 
    });
  }
}
