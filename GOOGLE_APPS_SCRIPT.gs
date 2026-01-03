/**
 * =====================================================
 * GOOGLE APPS SCRIPT - LEAD WEBHOOK HANDLER v2.0
 * =====================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheets → Extensions → Apps Script
 * 2. Delete any existing code
 * 3. Paste this entire script
 * 4. Save (Ctrl+S)
 * 5. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the deployment URL and update CONFIG in your script.js
 * 
 * SHEET REQUIREMENTS:
 * - Sheet named "Leads" with headers in row 1
 * - Sheet named "Webhook Errors" with headers in row 1
 */

// ==================== CONFIGURATION ====================
const LEADS_SHEET_NAME = "Leads";
const ERRORS_SHEET_NAME = "Webhook Errors";

// Column order for Leads sheet (must match headers exactly)
const LEAD_COLUMNS = [
  "Timestamp",
  "First Name", 
  "Last Name",
  "Phone",
  "Email",
  "Zip Code",
  "Quiz Answers",
  "Source URL"
];

// ==================== MAIN HANDLER ====================

/**
 * Handles POST requests from the landing page
 * This is the ONLY entry point for lead submissions
 */
function doPost(e) {
  const startTime = new Date();
  
  try {
    // Parse the incoming payload
    let payload;
    
    if (!e || !e.postData) {
      throw new Error("No POST data received");
    }
    
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      throw new Error("Invalid JSON payload: " + parseError.message);
    }
    
    // Validate required fields
    const requiredFields = ['first_name', 'email', 'phone', 'zip'];
    for (const field of requiredFields) {
      if (!payload[field]) {
        throw new Error("Missing required field: " + field);
      }
    }
    
    // Get or create the Leads sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let leadsSheet = ss.getSheetByName(LEADS_SHEET_NAME);
    
    if (!leadsSheet) {
      leadsSheet = ss.insertSheet(LEADS_SHEET_NAME);
      // Add headers
      leadsSheet.getRange(1, 1, 1, LEAD_COLUMNS.length).setValues([LEAD_COLUMNS]);
      leadsSheet.getRange(1, 1, 1, LEAD_COLUMNS.length).setFontWeight("bold");
      // Protect header row
      const protection = leadsSheet.getRange(1, 1, 1, LEAD_COLUMNS.length).protect();
      protection.setDescription("Header row - protected");
    }
    
    // Format phone to E.164 if not already
    let phone = payload.phone || '';
    if (phone && !phone.startsWith('+')) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        phone = '+1' + digits;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        phone = '+' + digits;
      }
    }
    
    // Build the row data
    const rowData = [
      payload.timestamp || new Date().toISOString(),  // Timestamp
      payload.first_name || '',                       // First Name
      payload.last_name || '',                        // Last Name
      phone,                                          // Phone (E.164)
      payload.email || '',                            // Email
      payload.zip || '',                              // Zip Code
      payload.quiz_answers || '',                     // Quiz Answers (JSON string)
      payload.page_url || ''                          // Source URL
    ];
    
    // Append the row
    leadsSheet.appendRow(rowData);
    
    // Log success
    const duration = new Date() - startTime;
    console.log(`✅ Lead saved successfully in ${duration}ms: ${payload.first_name} ${payload.last_name} - ${payload.email}`);
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true,
        message: "Lead saved successfully",
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Log error
    console.error("❌ Webhook error:", error.message);
    logError(error, e);
    
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.message 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles GET requests (for testing the endpoint)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: "ok",
      message: "Webhook is active. Use POST to submit leads.",
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== ERROR LOGGING ====================

/**
 * Logs errors to a separate sheet for debugging
 */
function logError(error, event) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let errorsSheet = ss.getSheetByName(ERRORS_SHEET_NAME);
    
    if (!errorsSheet) {
      errorsSheet = ss.insertSheet(ERRORS_SHEET_NAME);
      errorsSheet.getRange(1, 1, 1, 4).setValues([["Timestamp", "Error Message", "Stack Trace", "Raw Payload"]]);
      errorsSheet.getRange(1, 1, 1, 4).setFontWeight("bold");
    }
    
    const rawPayload = event && event.postData ? event.postData.contents : "No payload";
    
    errorsSheet.appendRow([
      new Date().toISOString(),
      error.message || String(error),
      error.stack || "No stack trace",
      rawPayload
    ]);
    
  } catch (logError) {
    console.error("Failed to log error:", logError);
  }
}

// ==================== UTILITIES ====================

/**
 * Test function - run manually to verify setup
 */
function testWebhook() {
  const testPayload = {
    postData: {
      contents: JSON.stringify({
        first_name: "Test",
        last_name: "User",
        phone: "+16071234567",
        email: "test@example.com",
        zip: "13901",
        quiz_answers: '{"homeowner":"yes","ab_variant":"A"}',
        page_url: "https://example.com/test",
        timestamp: new Date().toISOString()
      })
    }
  };
  
  const result = doPost(testPayload);
  console.log("Test result:", result.getContent());
}

/**
 * Initialize sheets with proper headers
 * Run this once to set up the spreadsheet
 */
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Leads sheet
  let leadsSheet = ss.getSheetByName(LEADS_SHEET_NAME);
  if (!leadsSheet) {
    leadsSheet = ss.insertSheet(LEADS_SHEET_NAME);
    console.log("Created Leads sheet");
  }
  
  // Set up headers if empty
  if (leadsSheet.getLastRow() === 0) {
    leadsSheet.getRange(1, 1, 1, LEAD_COLUMNS.length).setValues([LEAD_COLUMNS]);
    leadsSheet.getRange(1, 1, 1, LEAD_COLUMNS.length).setFontWeight("bold");
    leadsSheet.setFrozenRows(1);
    console.log("Added headers to Leads sheet");
  }
  
  // Create Errors sheet
  let errorsSheet = ss.getSheetByName(ERRORS_SHEET_NAME);
  if (!errorsSheet) {
    errorsSheet = ss.insertSheet(ERRORS_SHEET_NAME);
    errorsSheet.getRange(1, 1, 1, 4).setValues([["Timestamp", "Error Message", "Stack Trace", "Raw Payload"]]);
    errorsSheet.getRange(1, 1, 1, 4).setFontWeight("bold");
    errorsSheet.setFrozenRows(1);
    console.log("Created Webhook Errors sheet");
  }
  
  console.log("✅ Sheets initialized successfully!");
}
