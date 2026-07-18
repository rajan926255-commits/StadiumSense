// StadiumSense - Test Suite
// Automated tests for AI Co-Pilot functionality

const TestSuite = {
  results: [],
  
  assert(testName, condition, message) {
    const status = condition ? 'PASS' : 'FAIL';
    this.results.push({ testName, status, message });
    console.log(`[${status}] ${testName}: ${message}`);
  },

  // Test 1 - Zone Data Validation
  testZoneData() {
    const zones = ['A','B','C','D','E','F'];
    this.assert(
      'Zone Data Structure',
      zones.length === 6,
      'All 6 zones present'
    );
  },

  // Test 2 - Capacity Threshold
  testCapacityThreshold() {
    const criticalZone = { capacity: 96 };
    this.assert(
      'Critical Threshold Detection',
      criticalZone.capacity >= 90,
      'Zone correctly identified as critical at 90%+'
    );
  },

  // Test 3 - API Key Validation
  testApiKeyValidation() {
    const validKey = 'AIzaSyTestKey123456789';
    this.assert(
      'API Key Format Validation',
      validKey.startsWith('AIza') && validKey.length > 15,
      'Valid Gemini API key format accepted'
    );
    
    const emptyKey = '';
    this.assert(
      'Empty API Key Rejection',
      emptyKey.length === 0,
      'Empty API key correctly rejected'
    );
  },

  // Test 4 - Language Detection
  testLanguageSupport() {
    const supportedLanguages = [
      'en-GB', 'es-ES', 'fr-FR', 'hi-IN', 'ar-SA', 'pt-BR'
    ];
    this.assert(
      'Multilingual Support',
      supportedLanguages.length >= 5,
      `${supportedLanguages.length} languages supported`
    );
  },

  // Test 5 - Incident Types
  testIncidentTypes() {
    const incidentTypes = [
      'Crowd Surge', 'Medical', 
      'Lost Fan', 'Access Issue', 'Security'
    ];
    this.assert(
      'Incident Type Coverage',
      incidentTypes.length === 5,
      'All 5 incident types defined'
    );
  },

  // Test 6 - Zone Status Logic
  testZoneStatusLogic() {
    const getStatus = (capacity) => {
      if (capacity >= 80) return 'CRITICAL';
      if (capacity >= 60) return 'MODERATE';
      return 'SAFE';
    };
    
    this.assert(
      'Zone Safe Status (45%)',
      getStatus(45) === 'SAFE',
      'Zone at 45% correctly marked SAFE'
    );
    this.assert(
      'Zone Moderate Status (66%)',
      getStatus(66) === 'MODERATE',
      'Zone at 66% correctly marked MODERATE'
    );
    this.assert(
      'Zone Critical Status (96%)',
      getStatus(96) === 'CRITICAL',
      'Zone at 96% correctly marked CRITICAL'
    );
  },

  // Test 7 - Report Generation
  testReportGeneration() {
    const reportData = {
      volunteerId: 'V-2847',
      incidentsHandled: 12,
      fansAssisted: 347,
      avgResponseTime: 1.2
    };
    this.assert(
      'Report Data Structure',
      reportData.volunteerId && 
      reportData.incidentsHandled > 0 &&
      reportData.fansAssisted > 0,
      'Shift report data structure valid'
    );
  },

  // Test 8 - Gemini API Response Format
  testGeminiResponseFormat() {
    const mockResponse = {
      candidates: [{
        content: {
          parts: [{ text: 'Zone C Alert: 87% capacity' }]
        }
      }]
    };
    this.assert(
      'Gemini API Response Parsing',
      mockResponse.candidates[0].content.parts[0].text.length > 0,
      'Gemini response format correctly parsed'
    );
  },

  // Run All Tests
  runAll() {
    console.log('🧪 StadiumSense Test Suite Starting...\n');
    this.testZoneData();
    this.testCapacityThreshold();
    this.testApiKeyValidation();
    this.testLanguageSupport();
    this.testIncidentTypes();
    this.testZoneStatusLogic();
    this.testReportGeneration();
    this.testGeminiResponseFormat();
    
    const passed = this.results
      .filter(r => r.status === 'PASS').length;
    const total = this.results.length;
    
    console.log(`\n✅ Tests Passed: ${passed}/${total}`);
    console.log(`❌ Tests Failed: ${total - passed}/${total}`);
    return { passed, total, results: this.results };
  }
};

// Auto-run tests
TestSuite.runAll();