// api/captur3d-floor-plans.js
// Vercel Serverless Function to fetch 3D floor plans from CAPTUR3D API

const CAPTUR3D_API_KEY = 'nVK8f1nI36SBX8Oxmt+8PQchxhmLYEtkZgA/Let1GeM=';
const CAPTUR3D_BASE_URL = 'https://captur3d.io/api/v2';
const API_VERSION = '2025-01-01';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('Fetching floor plans from CAPTUR3D...');
    
    // Fetch all properties with floor plans
    const allFloorPlans = await getAllFloorPlans();
    
    // Filter for 3D only
    const floorPlans3D = filter3DFloorPlans(allFloorPlans);
    
    console.log(`Found ${floorPlans3D.length} 3D floor plans`);
    
    // Return response
    return res.status(200).json({
      success: true,
      count: floorPlans3D.length,
      data: floorPlans3D
    });

  } catch (error) {
    console.error('Error fetching floor plans:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch floor plans'
    });
  }
}

/**
 * Fetch all floor plans from CAPTUR3D API
 */
async function getAllFloorPlans() {
  const allFloorPlans = [];
  let page = 1;
  const pageSize = 50;
  let hasMore = true;

  while (hasMore) {
    try {
      // Fetch properties for this page
      const propertiesUrl = `${CAPTUR3D_BASE_URL}/properties?page[size]=${pageSize}&page[after]=${(page - 1) * pageSize}`;
      
      const propertiesResponse = await fetch(propertiesUrl, {
        headers: {
          'Authorization': `Bearer ${CAPTUR3D_API_KEY}`,
          'x-api-version': API_VERSION,
          'Content-Type': 'application/json'
        }
      });

      if (!propertiesResponse.ok) {
        throw new Error(`Properties API error: ${propertiesResponse.status}`);
      }

      const propertiesData = await propertiesResponse.json();
      const properties = propertiesData.data || [];

      if (properties.length === 0) {
        hasMore = false;
        break;
      }

      // For each property, fetch its floor plans
      for (const property of properties) {
        const propertyId = property.id;
        
        // Fetch property details with floor plans expanded
        const detailUrl = `${CAPTUR3D_BASE_URL}/properties/${propertyId}?expand=floor_plans`;
        
        const detailResponse = await fetch(detailUrl, {
          headers: {
            'Authorization': `Bearer ${CAPTUR3D_API_KEY}`,
            'x-api-version': API_VERSION,
            'Content-Type': 'application/json'
          }
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          const floorPlans = detailData.data?.floor_plans || [];
          
          // Add property context to each floor plan
          floorPlans.forEach(plan => {
            plan.property_name = detailData.data?.display_name || 'Unnamed Property';
            plan.property_address = detailData.data?.address?.street_address || '';
            allFloorPlans.push(plan);
          });
        }
      }

      // Check if there are more pages
      hasMore = propertiesData.meta?.has_more || false;
      page++;

      // Safety limit: don't fetch more than 10 pages (500 properties)
      if (page > 10) {
        hasMore = false;
      }

    } catch (error) {
      console.error(`Error on page ${page}:`, error);
      hasMore = false;
    }
  }

  return allFloorPlans;
}

/**
 * Filter for 3D floor plans only (JPG/JPEG images only)
 */
function filter3DFloorPlans(floorPlans) {
  return floorPlans.filter(plan => {
    const name = (plan.name || '').toLowerCase();
    const tags = plan.tags || [];
    
    // Check if it's a 3D floor plan
    const is3D = (
      tags.includes('3d') || 
      name.includes('3d') ||
      (!tags.includes('2d') && !name.includes('2d'))
    );
    
    // ONLY show JPG/JPEG files (no PNG, PDF, or SVG)
    const isJPEG = name.endsWith('.jpg') || name.endsWith('.jpeg');
    
    return is3D && isJPEG;
  });
}
