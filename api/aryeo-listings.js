// Vercel Serverless Function to fetch listings from Aryeo API
// Fixed based on Aryeo API documentation

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
    const { page = 1, per_page = 25, search = '' } = req.query;

    // Build Aryeo API URL - using correct v1 endpoint
    const baseUrl = 'https://api.aryeo.com/v1/listings';
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString(),
      sort: '-created_at',
      // Include related data - these are the correct parameter names from docs
      include: 'images,property_website,floor_plans,interactive_content'
    });

    // Add search filter if provided
    if (search && search.trim()) {
      params.append('filter[search]', search.trim());
    }

    const apiUrl = `${baseUrl}?${params.toString()}`;

    console.log('Fetching from Aryeo API:', apiUrl);

    // Fetch from Aryeo API with correct Authorization header format
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.ARYEO_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    console.log('Aryeo API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Aryeo API error:', response.status, errorText);
      throw new Error(`Aryeo API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Aryeo API success, listings count:', data.data?.length || 0);

    // Transform the data to what our frontend needs
    const transformedData = {
      listings: (data.data || []).map(listing => {
        // Build full address from individual components
        const addressParts = [];
        if (listing.address?.street_number) addressParts.push(listing.address.street_number);
        if (listing.address?.street_name) addressParts.push(listing.address.street_name);
        const streetAddress = addressParts.join(' ');
        
        const cityStateParts = [];
        if (listing.address?.city) cityStateParts.push(listing.address.city);
        if (listing.address?.state_or_province) cityStateParts.push(listing.address.state_or_province);
        const cityState = cityStateParts.join(', ');

        return {
          id: listing.id,
          address: listing.address ? {
            street: streetAddress || listing.address.unparsed_address_part_one || 'Address Not Available',
            city: listing.address.city || '',
            state: listing.address.state_or_province || '',
            zip: listing.address.postal_code || '',
            full: listing.address.unparsed_address || `${streetAddress}, ${cityState}`.trim()
          } : {
            street: 'Address Not Available',
            city: '',
            state: '',
            zip: '',
            full: 'Address Not Available'
          },
          thumbnail: listing.images && listing.images.length > 0 
            ? (listing.images[0].thumbnail_url || listing.images[0].large_url || listing.thumbnail_url)
            : listing.thumbnail_url || null,
          propertyWebsiteUrl: listing.property_website?.branded_url || listing.property_website?.unbranded_url || null,
          imageCount: listing.images ? listing.images.length : 0,
          has3DTour: listing.interactive_content && listing.interactive_content.length > 0,
          hasFloorPlan: listing.floor_plans && listing.floor_plans.length > 0,
          propertyType: listing.type || 'Residential',
          status: listing.status || 'ACTIVE',
          price: listing.price?.list_price_formatted || null,
          bedrooms: listing.building?.bedrooms || null,
          bathrooms: listing.building?.bathrooms || null,
          squareFeet: listing.building?.square_feet || null
        };
      }),
      pagination: {
        total: data.meta?.total || 0,
        perPage: data.meta?.per_page || 25,
        currentPage: data.meta?.current_page || 1,
        lastPage: data.meta?.last_page || 1
      }
    };

    res.status(200).json(transformedData);

  } catch (error) {
    console.error('Error fetching Aryeo listings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch listings',
      message: error.message,
      details: error.toString()
    });
  }
}
