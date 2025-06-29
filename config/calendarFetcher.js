const axios = require('axios');
const ical = require('node-ical');

/**
 * Calculate the academic year based on quarter and year
 * @param {string} quarter - The quarter name (fall, winter, spring, summer)
 * @param {number} year - The year
 * @returns {string} Academic year in format "YYYY-YYYY"
 */
function getAcademicYear(quarter, year) {
  if (quarter === 'fall') {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Fetch UCSD academic calendar ICS file
 * @param {string} quarter - The quarter name
 * @param {number} year - The year
 * @returns {Promise<Object>} Parsed ICS data
 */
async function fetchUCSDCalendar(quarter, year) {
  const academicYear = getAcademicYear(quarter, year);
  const url = `https://blink.ucsd.edu/_files/SCI-tab/${academicYear}-academic-calendar.ics`;
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebRegExport/1.0)'
      }
    });
    
    if (response.data.includes('<!DOCTYPE html>')) {
      throw new Error('Calendar not available for this year');
    }
    
    return ical.parseICS(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new Error(`Calendar not found for ${academicYear}`);
    }
    throw new Error(`Failed to fetch calendar: ${error.message}`);
  }
}

/**
 * Convert date to YYYYMMDD format for excludedDates
 * @param {Date} date - The date to format
 * @returns {string} Date in YYYYMMDD format
 */
function formatExcludedDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Extract quarter dates and holidays from calendar data
 * @param {Object} calendarData - Parsed ICS data
 * @param {string} quarter - The quarter name
 * @returns {Object} Quarter start, end, and holidays
 */
function extractQuarterDates(calendarData, quarter) {
  const events = Object.values(calendarData);
  let quarterStart = null;
  let quarterEnd = null;
  const holidays = [];
  
  // Handle summer session variations
  const searchQuarter = quarter.replace(/summerSession[12]/, 'summer');
  
  events.forEach(event => {
    if (event.type !== 'VEVENT') return;
    
    // Handle node-ical's object structure for summary
    let summaryText = '';
    if (typeof event.summary === 'object' && event.summary?.val) {
      summaryText = event.summary.val;
    } else if (typeof event.summary === 'string') {
      summaryText = event.summary;
    }
    const summary = summaryText.toLowerCase();
    
    // Find quarter start - look for "instruction begins"
    if (summary.includes('instruction') && summary.includes('begin') && summary.includes(searchQuarter)) {
      quarterStart = event.start;
    }
    
    // Find quarter end - look for "instruction ends"
    if (summary.includes('instruction') && summary.includes('end') && summary.includes(searchQuarter)) {
      quarterEnd = event.start;
    }
    
    // Extract holidays - events containing "day" but not "fifteenth day"
    if (summary.includes('day') && !summary.includes('fift')) {
      const eventDate = event.start;
      holidays.push(eventDate);
    }
  });
  
  // Filter holidays to only include those within quarter boundaries
  const filteredHolidays = holidays.filter(holiday => {
    if (!quarterStart || !quarterEnd) return false;
    return holiday >= quarterStart && holiday <= quarterEnd;
  });
  
  // Convert holidays to YYYYMMDD format
  const excludedDates = filteredHolidays.map(date => formatExcludedDate(date));
  
  return {
    start: quarterStart,
    end: quarterEnd,
    excludedDates
  };
}

/**
 * Fetch and process quarter data from UCSD calendar
 * @param {string} quarter - Quarter name (e.g., 'fall', 'winter', 'spring', 'summerSession1')
 * @param {number} year - Year
 * @returns {Promise<Object>} Quarter data with dates and holidays
 */
async function fetchQuarterData(quarter, year) {
  try {
    const calendarData = await fetchUCSDCalendar(quarter, year);
    const quarterData = extractQuarterDates(calendarData, quarter);
    
    if (!quarterData.start || !quarterData.end) {
      throw new Error(`Could not find ${quarter} ${year} dates in calendar`);
    }
    
    // Add metadata
    quarterData.metadata = {
      createdAt: new Date(),
      source: 'auto',
      academicYear: getAcademicYear(quarter, year),
      lastUpdated: new Date()
    };
    
    return quarterData;
  } catch (error) {
    console.error(`Error fetching quarter data for ${quarter} ${year}:`, error);
    throw error;
  }
}

/**
 * Fetch all quarter data for an academic year
 * @param {number} year - The fall year of the academic year
 * @returns {Promise<Object>} All quarters data
 */
async function fetchAcademicYearData(year) {
  const quarters = ['fall', 'winter', 'spring', 'summerSession1', 'summerSession2'];
  const quarterData = {};
  
  for (const quarter of quarters) {
    const quarterYear = quarter === 'fall' ? year : year + 1;
    const key = `${quarter}${quarterYear}`;
    
    try {
      console.log(`Fetching ${key}...`);
      quarterData[key] = await fetchQuarterData(quarter, quarterYear);
    } catch (error) {
      console.error(`Failed to fetch ${key}:`, error.message);
      // Continue with other quarters even if one fails
    }
  }
  
  return quarterData;
}

/**
 * Get the current or next active quarter based on today's date
 * @param {Object} quarters - All available quarters
 * @returns {string} The default quarter key
 */
function getDefaultQuarter(quarters) {
  const today = new Date();
  const sortedQuarters = Object.entries(quarters)
    .filter(([_, data]) => data.start && data.end)
    .sort((a, b) => a[1].start - b[1].start);
  
  // Find current quarter
  for (const [key, data] of sortedQuarters) {
    if (today >= data.start && today <= data.end) {
      return key;
    }
  }
  
  // Find next upcoming quarter
  for (const [key, data] of sortedQuarters) {
    if (today < data.start) {
      return key;
    }
  }
  
  // Fallback to last quarter if all are in the past
  return sortedQuarters.length > 0 ? sortedQuarters[sortedQuarters.length - 1][0] : null;
}

module.exports = {
  fetchUCSDCalendar,
  extractQuarterDates,
  fetchQuarterData,
  fetchAcademicYearData,
  getDefaultQuarter,
  getAcademicYear
};