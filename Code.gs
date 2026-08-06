
const SHEET_ID = '1wJrE03884n8xcFvazJDpylAplWfLco1NV17oGM4J0-A';

function doPost(e) {
  const res = { success: false, message: 'Unknown Error', data: null };
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No payload received by backend.");
    }

    const json = JSON.parse(e.postData.contents);
    const action = json.action;
    const ss = SpreadsheetApp.openById(SHEET_ID);

    if (action === 'test_connection') {
      res.success = true;
      res.message = 'System Online';
    } else if (action === 'login') {
      const user = findUser(ss, json.email, json.password);
      if (user) {
        res.success = true;
        res.data = user;
      } else {
        res.message = 'Invalid credentials';
      }
    } else if (action === 'get_user_plan') {
      // Fix: Strictly require role for determining visibility logic
      res.data = getUserPlan(ss, json.uid, json.role);
      res.success = true;
    } else if (action === 'get_admin_stats') {
      res.data = getAdminStats(ss, json.requesterEmail, json.requesterRole);
      res.success = true;
    } else if (action === 'get_all_resources') {
      res.data = getAllResources(ss);
      res.success = true;
    } else if (action === 'admin_get_users') {
      res.data = fetchAllUsers(ss, json.requesterEmail, json.requesterRole);
      res.success = true;
    } else if (action === 'submit_progress') {
      res.data = updateProgress(ss, json.uid, json.resourceId, json.passed, json.score, json.timeTaken);
      res.success = true;
    } else if (action === 'bulk_import_resources') {
      const result = handleBulkImport(ss, json.resources);
      res.data = result;
      res.success = true;
    } else if (action === 'assign_manual_resource') {
      // Corrected Payload: targetUid, resourceId, adminId
      res.data = manualAssign(ss, json.targetUid, json.resourceId, json.adminId);
      res.success = true;
    } else if (action === 'save_transcript') {
      res.data = saveTranscript(ss, json.userId, json.transcript);
      res.success = true;
    } else if (action === 'get_transcripts') {
      res.data = getTranscripts(ss, json.userId);
      res.success = true;
    } else if (action === 'get_weekly_assignments') {
      res.data = getWeeklyAssignments(ss);
      res.success = true;
    } else if (action === 'assign_to_week') {
      res.data = assignToWeek(ss, json.weekNumber, json.resourceIds, json.adminId);
      res.success = true;
    } else if (action === 'proxy_gemini') {
      res.data = proxyGeminiCall(ss, json.model, json.payload);
      res.success = true;
    } else if (action === 'proxy_gemini_request') {
      res.data = proxyGeminiRequest(json.payload);
      res.success = true;
    } else if (action === 'addSingleUser') {
      res.data = addSingleUser(ss, json);
      res.success = true;
    } else if (action === 'get_wave_configs') {
      res.data = getWaveConfigs(ss);
      res.success = true;
    } else if (action === 'set_wave_config') {
      res.data = setWaveConfig(ss, json.waveNumber, json.goalType, json.goalMinutes);
      res.success = true;
    } else if (action === 'bulk_assign_roster') {
      res.data = bulkAssignRoster(ss, json.adminId, json.wave);
      res.success = true;
    } else if (action === 'saveLesson') {
      res.data = saveInteractiveLesson(ss, json.title, json.lessonData);
      res.success = true;
    } else if (action === 'saveAnswers') {
      res.data = saveFreeTextAnswers(ss, json.userId, json.lessonId, json.answers);
      res.success = true;
    } else if (action === 'getInteractiveLessons') {
      res.data = getInteractiveLessons(ss);
      res.success = true;
    } else if (action === 'getFreeTextAnswers') {
      res.data = getFreeTextAnswers(ss, json.lessonId, json.userId);
      res.success = true;
    } else if (action === 'assignLesson') {
      res.data = assignLesson(ss, json.userId, json.lessonId, json.adminId);
      res.success = true;
    } else if (action === 'batchAssignLessons') {
      res.data = batchAssignLessons(ss, json.userIds, json.lessonIds, json.adminId);
      res.success = true;
    } else if (action === 'getMyLessons') {
      res.data = getMyLessons(ss, json.userId);
      res.success = true;
    }

  } catch (err) {
    res.message = err.toString();
    console.error("Critical Backend Failure:", err);
  }
  return sendResponse(res);
}

function manualAssign(ss, uid, resourceId, adminId) {
  const sheet = ss.getSheetByName('Progress') || ss.insertSheet('Progress');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['UID', 'ResourceID', 'Status', 'Attempts', 'Score', 'LastAttempt', 'AssignedBy']);
  }
  const data = sheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(uid) && String(data[i][1]) === String(resourceId)) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow === -1) {
    sheet.appendRow([uid, resourceId, 'assigned', 0, 0, new Date(), adminId || 'System']);
  } else {
    const currentStatus = data[foundRow-1][2];
    // Allow overwriting status to 'assigned' if currently open or locked
    if (currentStatus === 'locked' || currentStatus === 'open' || !currentStatus) {
      sheet.getRange(foundRow, 3).setValue('assigned');
      sheet.getRange(foundRow, 7).setValue(adminId || 'System');
    }
  }
  return { status: 'assigned' };
}

function updateProgress(ss, uid, resourceId, passed, score, timeTaken) {
  const sheet = ss.getSheetByName('Progress') || ss.insertSheet('Progress');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['UID', 'ResourceID', 'Status', 'Attempts', 'Score', 'LastAttempt', 'TimeTaken']);
  }
  const data = sheet.getDataRange().getValues();
  const timeString = timeTaken ? (timeTaken + "s") : "N/A";
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(uid) && String(data[i][1]) === String(resourceId)) {
      foundRow = i + 1;
      break;
    }
  }

  const newStatus = passed ? 'completed' : 'assigned';
  if (foundRow !== -1) {
    const currentAttempts = data[foundRow-1][3] || 0;
    sheet.getRange(foundRow, 3, 1, 5).setValues([[newStatus, currentAttempts + 1, score, new Date(), timeString]]);
  } else {
    sheet.appendRow([uid, resourceId, newStatus, 1, score, new Date(), timeString]);
  }
  
  return { status: newStatus };
}

function getUserPlan(ss, uid, role) {
  const userSheet = ss.getSheetByName('Users');
  const resSheet = ss.getSheetByName('Resources');
  const progSheet = ss.getSheetByName('Progress');
  
  if (!userSheet || !resSheet) return { resources: [], weeklyMinutes: 0, weeklyProgress: 0 };

  const userData = userSheet.getDataRange().getValues();
  const userHeaders = userData[0];
  const uidIdx = userHeaders.indexOf('UID');
  const cefrIdx = userHeaders.indexOf('CEFRLevel');
  
  let userLevel = '';
  for (let i = 1; i < userData.length; i++) {
    if (String(userData[i][uidIdx]) === String(uid)) {
      userLevel = String(userData[i][cefrIdx]);
      break;
    }
  }

  const resData = resSheet.getDataRange().getValues();
  const resHeaders = resData[0].map(h => h.toLowerCase());
  const progData = progSheet ? progSheet.getDataRange().getValues() : [];

  const userPlan = [];
  const idIdx = resHeaders.indexOf('id');
  const titleIdx = resHeaders.indexOf('title');
  const urlIdx = resHeaders.indexOf('url');
  const typeIdx = resHeaders.indexOf('type');
  const tagsIdx = resHeaders.indexOf('tags');
  const levelIdx = resHeaders.indexOf('level');
  const objectiveIdx = resHeaders.indexOf('objective');
  const scrapedIdx = resHeaders.indexOf('scrapedtext');
  const durIdx = resHeaders.indexOf('duration');

  const isAdminOrCoach = (role === 'admin' || role === 'coach');
  const WEEKLY_GOAL = 180;
  const startOfWeek = getStartOfWeek();
  let weeklyMinutes = 0;

  for (let i = 1; i < resData.length; i++) {
    const resRow = resData[i];
    const resourceLevel = resRow[levelIdx];
    const resourceId = String(resRow[idIdx]);
    const duration = parseInt(String(resRow[durIdx] || '15')) || 15;
    
    if (!isAdminOrCoach && !isLevelMatch(resourceLevel, userLevel)) continue;

    let progress = { status: 'open', attempts: 0, score: 0, completedAt: null };
    if (progData.length > 1) {
      for (let j = 1; j < progData.length; j++) {
        if (String(progData[j][0]) === String(uid) && String(progData[j][1]) === resourceId) {
          const status = progData[j][2];
          const completedAt = progData[j][5];
          progress = { 
            status: status, 
            attempts: progData[j][3], 
            score: progData[j][4],
            completedAt: completedAt
          };

          if (status === 'completed' && completedAt) {
            const compDate = new Date(completedAt);
            if (compDate >= startOfWeek) {
              weeklyMinutes += duration;
            }
          }
          break;
        }
      }
    }

    userPlan.push({
      id: resourceId,
      title: String(resRow[titleIdx]),
      url: String(resRow[urlIdx]),
      type: String(resRow[typeIdx]),
      tags: String(resRow[tagsIdx] || "").split(',').filter(Boolean),
      level: String(resRow[levelIdx] || 'All'),
      objective: String(resRow[objectiveIdx] || ''),
      scrapedText: scrapedIdx > -1 ? String(resRow[scrapedIdx] || '') : '',
      duration: duration,
      progress: progress
    });
  }

  return {
    resources: userPlan,
    weeklyMinutes: weeklyMinutes,
    weeklyProgress: Math.min(Math.round((weeklyMinutes / WEEKLY_GOAL) * 100), 100)
  };
}

function getAdminStats(ss, requesterEmail, requesterRole) {
  const userSheet = ss.getSheetByName('Users');
  const resSheet = ss.getSheetByName('Resources');
  const progSheet = ss.getSheetByName('Progress');
  
  if (!userSheet || !resSheet || !progSheet) return { rosterAverage: 0, userStats: [] };

  const userData = userSheet.getDataRange().getValues();
  const resData = resSheet.getDataRange().getValues();
  const progData = progSheet.getDataRange().getValues();
  
  const resHeaders = resData[0].map(h => h.toLowerCase());
  const durIdx = resHeaders.indexOf('duration');
  const idIdx = resHeaders.indexOf('id');
  
  const resourceDurations = {};
  for (let i = 1; i < resData.length; i++) {
    resourceDurations[String(resData[i][idIdx])] = parseInt(String(resData[i][durIdx] || '15')) || 15;
  }

  const startOfWeek = getStartOfWeek();
  const userStats = [];
  let totalOverallProgress = 0;
  let agentCount = 0;

  const userHeaders = userData[0];
  const uidIdx = userHeaders.indexOf('UID');
  const roleIdx = userHeaders.indexOf('Role');

  for (let i = 1; i < userData.length; i++) {
    if (userData[i][roleIdx] !== 'agent') continue;
    
    const coachIdx = userHeaders.indexOf('AssignedCoach');
    const assignedCoach = String(userData[i][coachIdx] || 'Unassigned');
    if (requesterRole === 'coach' && assignedCoach !== requesterEmail) continue;
    
    const uid = String(userData[i][uidIdx]);
    agentCount++;
    
    let totalCompleted = 0;
    let totalAssigned = 0;
    let weeklyMinutes = 0;

    for (let j = 1; j < progData.length; j++) {
      if (String(progData[j][0]) === uid) {
        const resId = String(progData[j][1]);
        const status = progData[j][2];
        const completedAt = progData[j][5];
        const duration = resourceDurations[resId] || 15;

        if (status === 'completed' || status === 'assigned') {
          totalAssigned++;
        }
        if (status === 'completed') {
          totalCompleted++;
          if (completedAt) {
            const compDate = new Date(completedAt);
            if (compDate >= startOfWeek) {
              weeklyMinutes += duration;
            }
          }
        }
      }
    }

    const overallProgress = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;
    totalOverallProgress += overallProgress;

    userStats.push({
      userId: uid,
      weeklyMinutes: weeklyMinutes,
      weeklyProgress: Math.min(Math.round((weeklyMinutes / 180) * 100), 100),
      overallProgress: overallProgress,
      totalCompleted: totalCompleted,
      totalAssigned: totalAssigned
    });
  }

  return {
    rosterAverage: agentCount > 0 ? Math.round(totalOverallProgress / agentCount) : 0,
    userStats: userStats
  };
}

function getStartOfWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

function getAllResources(ss) {
  const sheet = ss.getSheetByName('Resources');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const h = data[0].map(h => h.toLowerCase());
  
  return data.slice(1).map(r => {
    return {
      id: String(r[h.indexOf('id')]),
      title: String(r[h.indexOf('title')]),
      url: String(r[h.indexOf('url')]),
      type: String(r[h.indexOf('type')]),
      tags: String(r[h.indexOf('tags')] || "").split(',').filter(Boolean),
      level: String(r[h.indexOf('level')] || 'All'),
      objective: String(r[h.indexOf('objective')] || ''),
      scrapedText: h.indexOf('scrapedtext') > -1 ? String(r[h.indexOf('scrapedtext')] || '') : '',
      duration: h.indexOf('duration') > -1 ? String(r[h.indexOf('duration')] || '10') : '10'
    };
  });
}

function findUser(ss, email, password) {
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const mapping = {};
  headers.forEach((h, i) => mapping[h] = i);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][mapping['Email']] === email && data[i][mapping['Password']] === password) {
      return {
        id: data[i][mapping['UID']],
        email: data[i][mapping['Email']],
        name: data[i][mapping['Name']],
        role: data[i][mapping['Role']],
        languageLevel: data[i][mapping['CEFRLevel']],
        shlData: safeParse(data[i][mapping['SHLData']]), 
        assignedCoach: data[i][mapping['AssignedCoach']] || 'Unassigned',
        performanceData: safeParse(data[i][mapping['PerformanceData']])
      };
    }
  }
  return null;
}

function fetchAllUsers(ss, requesterEmail, requesterRole) {
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const users = [];
  const mapping = {};
  headers.forEach((h, i) => mapping[h] = i);
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const assignedCoach = row[mapping['AssignedCoach']] || 'Unassigned';
    if (requesterRole === 'coach' && assignedCoach !== requesterEmail) continue;

    users.push({
      id: row[mapping['UID']],
      email: row[mapping['Email']],
      name: row[mapping['Name']],
      role: row[mapping['Role']],
      languageLevel: row[mapping['CEFRLevel']],
      shlData: safeParse(row[mapping['SHLData']]),
      assignedCoach: row[mapping['AssignedCoach']] || 'Unassigned',
      performanceData: safeParse(row[mapping['PerformanceData']])
    });
  }
  return users;
}

function handleBulkImport(ss, resources) {
  let sheet = ss.getSheetByName('Resources') || ss.insertSheet('Resources');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'title', 'url', 'type', 'tags', 'level', 'objective', 'scrapedText', 'duration']);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColIdx = 0; 

  const existingIds = data.slice(1).map(row => String(row[idColIdx]));
  
  resources.forEach(res => {
    const resId = String(res.id);
    const rowIdx = existingIds.indexOf(resId);
    const rowData = [
      resId,
      String(res.title || 'Untitled'),
      String(res.url || '').trim(),
      String(res.type || 'Article'),
      Array.isArray(res.tags) ? res.tags.join(',') : String(res.tags || 'General'),
      String(res.level || 'All'),
      String(res.objective || 'N/A'),
      res.scrapedText || "",
      res.duration || "10"
    ];

    if (rowIdx !== -1) {
      sheet.getRange(rowIdx + 2, 1, 1, 9).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      existingIds.push(resId);
    }
  });

  SpreadsheetApp.flush();
  return { count: resources.length, status: 'Success' };
}

function isLevelMatch(resourceLevel, userLevel) {
  const r = String(resourceLevel || 'All').toUpperCase();
  const u = String(userLevel || '').toUpperCase();
  if (r === 'ALL') return true;
  if (r === u) return true;
  // Fuzzy B1/B2/etc check
  if (u && r.indexOf(u) !== -1) return true;
  return false;
}

function safeParse(str) {
  if (!str) return {};
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch (e) {
    console.error("JSON Parse Error:", e);
    return {};
  }
}

function saveTranscript(ss, userId, transcript) {
  const sheet = ss.getSheetByName('Transcripts') || ss.insertSheet('Transcripts');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'UserID', 'Date', 'Topic', 'Duration', 'OverallScore', 'MessageData']);
  }
  const id = 't-' + Date.now();
  const dateString = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const messageData = JSON.stringify(transcript.messages || []);
  
  sheet.appendRow([
    id,
    userId,
    dateString,
    transcript.topic || 'General Coaching Session',
    transcript.duration || '5:00',
    transcript.overallScore || 'B2 Passing',
    messageData
  ]);
  return { id };
}

function getTranscripts(ss, userId) {
  const sheet = ss.getSheetByName('Transcripts');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const transcripts = [];
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(userId)) {
      transcripts.push({
        id: data[i][0],
        userId: data[i][1],
        date: data[i][2],
        topic: data[i][3],
        duration: data[i][4],
        overallScore: data[i][5],
        messages: safeParse(data[i][6])
      });
    }
  }
  return transcripts;
}

function proxyGeminiCall(ss, modelName, payload) {
  // Retrieve backend API Key from ScriptProperties or spreadsheet Configuration
  let key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    const configSheet = ss.getSheetByName('Config');
    if (configSheet) {
      const cellVal = configSheet.getRange(1, 2).getValue();
      if (cellVal) key = cellVal;
    }
  }
  
  // Use a hardcoded project fallback placeholder if none is registered in standard properties
  const targetKey = key || 'AIzaSy' + 'DummyKeyPlaceholder'; 
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + (modelName || 'gemini-3.1-flash-lite') + ':generateContent?key=' + targetKey;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const text = response.getContentText();
  
  if (code !== 200) {
    throw new Error('Gemini API call failed with code ' + code + ': ' + text);
  }
  
  return JSON.parse(text);
}

function proxyGeminiRequest(payload) {
  // Retrieve backend API Key from ScriptProperties or spreadsheet Configuration
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);
      var configSheet = ss.getSheetByName('Config');
      if (configSheet) {
        var cellVal = configSheet.getRange(1, 2).getValue();
        if (cellVal) key = cellVal;
      }
    } catch(e) {}
  }
  
  var targetKey = key || 'AIzaSy' + 'DummyKeyPlaceholder'; 
  var modelName = payload.model || 'gemini-3.1-flash-lite';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + targetKey;
  
  // Build standard Gemini request from the prompt and systemInstruction
  var prompt = payload.prompt || '';
  var systemInstruction = payload.systemInstruction || '';
  
  var contents = [];
  if (payload.contents) {
    contents = payload.contents;
  } else {
    contents = [{ role: 'user', parts: [{ text: prompt }] }];
  }
  
  var geminiPayload = {
    contents: contents
  };
  
  if (systemInstruction) {
    geminiPayload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }
  
  if (payload.config) {
    geminiPayload.generationConfig = payload.config;
  } else if (payload.generationConfig) {
    geminiPayload.generationConfig = payload.generationConfig;
  }
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(geminiPayload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  
  if (code !== 200) {
    throw new Error('Gemini API call failed with code ' + code + ': ' + text);
  }
  
  return JSON.parse(text);
}

function getWeeklyAssignments(ss) {
  var sheet = ss.getSheetByName('WeeklyAssignments') || ss.insertSheet('WeeklyAssignments');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['WeekNumber', 'ResourceID', 'AssignedBy', 'AssignedDate']);
    return {};
  }
  var data = sheet.getDataRange().getValues();
  var assignments = {};
  for (var i = 1; i < data.length; i++) {
    var weekNum = Number(data[i][0]);
    var resId = String(data[i][1]).trim();
    if (isNaN(weekNum) || !resId) continue;
    if (!assignments[weekNum]) {
      assignments[weekNum] = [];
    }
    if (assignments[weekNum].indexOf(resId) === -1) {
      assignments[weekNum].push(resId);
    }
  }
  return assignments;
}

function assignToWeek(ss, weekNumber, resourceIds, adminId) {
  var sheet = ss.getSheetByName('WeeklyAssignments') || ss.insertSheet('WeeklyAssignments');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['WeekNumber', 'ResourceID', 'AssignedBy', 'AssignedDate']);
  }
  
  var numericWeek = Number(weekNumber);
  if (isNaN(numericWeek)) {
    throw new Error('Invalid Week Number ' + weekNumber);
  }
  
  var data = sheet.getDataRange().getValues();
  var rowsToKeep = [];
  rowsToKeep.push(data[0]); // Header
  
  for (var i = 1; i < data.length; i++) {
    var wNum = Number(data[i][0]);
    if (wNum !== numericWeek) {
      rowsToKeep.push(data[i]);
    }
  }
  
  // Clear the sheet
  sheet.clearContents();
  
  // Re-write the kept rows
  if (rowsToKeep.length > 0) {
    sheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
  }
  
  // Now append the new resource definitions
  if (Array.isArray(resourceIds)) {
    var today = new Date();
    for (var i = 0; i < resourceIds.length; i++) {
      var rId = String(resourceIds[i]).trim();
      if (rId) {
        sheet.appendRow([numericWeek, rId, adminId || 'System', today]);
      }
    }
  }
  
  // Return the complete up-to-date weekly assignments map
  return getWeeklyAssignments(ss);
}

function sendResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function addSingleUser(ss, data) {
  var sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['UID', 'Name', 'Email', 'Role', 'Password', 'AssignedCoach', 'CEFRLevel', 'WaveNumber', 'SHLData', 'PerformanceData']);
  }
  
  var sheetData = sheet.getDataRange().getValues();
  var headers = sheetData[0];
  var mapping = {};
  for (var i = 0; i < headers.length; i++) {
    mapping[headers[i].toString().trim()] = i;
  }
  
  // Create a default row of empty cells with correct length
  var newRow = [];
  for (var i = 0; i < headers.length; i++) {
    newRow.push('');
  }
  
  // Generate random pass/code like '1234'
  var randomPass = Math.floor(1000 + Math.random() * 9000).toString();
  var newUid = 'u-' + Date.now();
  
  var setInMapping = function(possibleHeaders, val) {
    for (var i = 0; i < possibleHeaders.length; i++) {
      var h = possibleHeaders[i];
      if (mapping[h] !== undefined) {
        newRow[mapping[h]] = val;
        return;
      }
    }
  };
  
  setInMapping(['UID', 'id', 'ID'], newUid);
  setInMapping(['Name', 'name'], data.name || '');
  setInMapping(['Email', 'email'], data.email || '');
  setInMapping(['Role', 'role'], data.role || 'agent');
  setInMapping(['Password', 'password', 'AccessCode'], randomPass);
  setInMapping(['AssignedCoach', 'assignedCoach'], 'Unassigned');
  setInMapping(['CEFRLevel', 'LanguageLevel', 'languageLevel'], 'B1');
  setInMapping(['WaveNumber', 'Wave', 'waveNumber', 'wave'], data.waveNumber || '');
  setInMapping(['SHLData'], '{}');
  setInMapping(['PerformanceData'], '{}');
  
  sheet.appendRow(newRow);
  SpreadsheetApp.flush();
  return { id: newUid, name: data.name, email: data.email };
}

function getWaveConfigs(ss) {
  var sheet = ss.getSheetByName('WaveConfig');
  if (!sheet) {
    sheet = ss.insertSheet('WaveConfig');
    sheet.appendRow(['WaveNumber', 'DefaultGoal', 'CurrentWeekGoal']);
    return {};
  }
  
  var data = sheet.getDataRange().getValues();
  var configs = {};
  for (var i = 1; i < data.length; i++) {
    var waveNum = String(data[i][0]).trim();
    if (!waveNum) continue;
    var defaultGoal = Number(data[i][1]) || 180;
    var currentWeekGoal = data[i][2] !== '' ? Number(data[i][2]) : null;
    var activeGoal = currentWeekGoal !== null && currentWeekGoal > 0 ? currentWeekGoal : defaultGoal;
    
    configs[waveNum] = {
      defaultGoal: defaultGoal,
      currentWeekGoal: currentWeekGoal,
      activeGoal: activeGoal
    };
  }
  return configs;
}

function setWaveConfig(ss, waveNumber, goalType, goalMinutes) {
  var sheet = ss.getSheetByName('WaveConfig');
  if (!sheet) {
    sheet = ss.insertSheet('WaveConfig');
    sheet.appendRow(['WaveNumber', 'DefaultGoal', 'CurrentWeekGoal']);
  }
  
  var data = sheet.getDataRange().getValues();
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(waveNumber).trim()) {
      foundRow = i + 1;
      break;
    }
  }
  
  var colIndex = (goalType === 'default') ? 2 : 3; // DefaultGoal is column 2, CurrentWeekGoal is column 3
  var valToSet = (goalMinutes !== null && goalMinutes !== undefined && goalMinutes !== '') ? Number(goalMinutes) : '';
  
  if (foundRow !== -1) {
    sheet.getRange(foundRow, colIndex).setValue(valToSet);
  } else {
    var defaultVal = (goalType === 'default') ? Number(goalMinutes) : 180;
    var weeklyVal = (goalType === 'weekly') ? Number(goalMinutes) : '';
    sheet.appendRow([waveNumber, defaultVal, weeklyVal]);
  }
  
  SpreadsheetApp.flush();
  return getWaveConfigs(ss);
}

function bulkAssignRoster(ss, adminId, wave) {
  var userSheet = ss.getSheetByName('Users');
  var resSheet = ss.getSheetByName('Resources');
  var progSheet = ss.getSheetByName('Progress') || ss.insertSheet('Progress');
  
  if (!userSheet || !resSheet) return { success: false, message: 'Missing sheets' };
  
  if (progSheet.getLastRow() === 0) {
    progSheet.appendRow(['UID', 'ResourceID', 'Status', 'Attempts', 'Score', 'LastAttempt', 'AssignedBy']);
  }
  
  var userData = userSheet.getDataRange().getValues();
  var userHeaders = userData[0];
  var uidIdx = -1, cefrIdx = -1, waveIdx = -1, roleIdx = -1;
  
  for (var i = 0; i < userHeaders.length; i++) {
    var h = userHeaders[i].toString().trim();
    if (h === 'UID') uidIdx = i;
    else if (h === 'CEFRLevel') cefrIdx = i;
    else if (h === 'WaveNumber') waveIdx = i;
    else if (h === 'Role') roleIdx = i;
  }
  
  var resData = resSheet.getDataRange().getValues();
  var resHeaders = resData[0].map(function(h) { return h.toString().toLowerCase(); });
  var idIdx = resHeaders.indexOf('id');
  var levelIdx = resHeaders.indexOf('level');
  
  var progData = progSheet.getDataRange().getValues();
  var existingProgMap = {};
  for (var j = 1; j < progData.length; j++) {
    var key = String(progData[j][0]) + '_' + String(progData[j][1]);
    existingProgMap[key] = {
      row: j + 1,
      status: progData[j][2]
    };
  }
  
  var usersToAssign = [];
  for (var i = 1; i < userData.length; i++) {
    var role = String(userData[i][roleIdx]).trim().toLowerCase();
    if (role !== 'agent') continue;
    
    var userWave = String(userData[i][waveIdx]).trim();
    if (wave && wave !== 'all' && userWave !== wave) continue;
    
    usersToAssign.push({
      uid: String(userData[i][uidIdx]),
      cefr: String(userData[i][cefrIdx])
    });
  }
  
  var resources = [];
  for (var i = 1; i < resData.length; i++) {
    resources.push({
      id: String(resData[i][idIdx]),
      level: String(resData[i][levelIdx])
    });
  }
  
  var newRowsCount = 0;
  var updatedRowsCount = 0;
  var rowsToAppend = [];
  
  for (var u = 0; u < usersToAssign.length; u++) {
    var user = usersToAssign[u];
    for (var r = 0; r < resources.length; r++) {
      var res = resources[r];
      if (isLevelMatch(res.level, user.cefr)) {
        var key = user.uid + '_' + res.id;
        if (!existingProgMap[key]) {
          rowsToAppend.push([user.uid, res.id, 'assigned', 0, 0, new Date(), adminId || 'System']);
          newRowsCount++;
        } else {
          var currentStatus = existingProgMap[key].status;
          if (currentStatus === 'locked' || currentStatus === 'open' || !currentStatus) {
            progSheet.getRange(existingProgMap[key].row, 3).setValue('assigned');
            progSheet.getRange(existingProgMap[key].row, 7).setValue(adminId || 'System');
            updatedRowsCount++;
          }
        }
      }
    }
  }
  
  if (rowsToAppend.length > 0) {
    var startRow = progSheet.getLastRow() + 1;
    progSheet.getRange(startRow, 1, rowsToAppend.length, 7).setValues(rowsToAppend);
  }
  
  SpreadsheetApp.flush();
  return { 
    success: true, 
    newAssignments: newRowsCount, 
    updatedAssignments: updatedRowsCount 
  };
}

function saveInteractiveLesson(ss, title, lessonData) {
  const sheet = ss.getSheetByName('Brain_InteractiveLessons') || ss.insertSheet('Brain_InteractiveLessons');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'Title', 'CreatedAt', 'LessonDataJSON']);
  }
  const id = 'les_' + Utilities.getUuid();
  const createdAt = new Date().toISOString();
  const jsonString = typeof lessonData === 'string' ? lessonData : JSON.stringify(lessonData);
  
  sheet.appendRow([id, title || 'Untitled Interactive Lesson', createdAt, jsonString]);
  return { id: id, title: title, createdAt: createdAt };
}

function saveFreeTextAnswers(ss, userId, lessonId, answers) {
  const sheet = ss.getSheetByName('Brain_FreeTextAnswers') || ss.insertSheet('Brain_FreeTextAnswers');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'UserID', 'LessonID', 'SubmittedAt', 'AnswersJSON']);
  }
  const id = 'ans_' + Utilities.getUuid();
  const submittedAt = new Date().toISOString();
  const jsonString = typeof answers === 'string' ? answers : JSON.stringify(answers);
  
  sheet.appendRow([id, userId || 'Anonymous', lessonId || 'Unknown', submittedAt, jsonString]);
  return { id: id, submittedAt: submittedAt };
}

function getInteractiveLessons(ss) {
  const sheet = ss.getSheetByName('Brain_InteractiveLessons');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const lessons = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    let parsedData = null;
    try {
      parsedData = typeof row[3] === 'string' ? JSON.parse(row[3]) : row[3];
    } catch (e) {
      parsedData = { raw: row[3] };
    }
    lessons.push({
      id: String(row[0]),
      title: String(row[1]),
      createdAt: row[2],
      lessonData: parsedData
    });
  }
  return lessons;
}

function getFreeTextAnswers(ss, lessonId, userId) {
  const sheet = ss.getSheetByName('Brain_FreeTextAnswers');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const answersList = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const rUserId = String(row[1]);
    const rLessonId = String(row[2]);
    if (lessonId && rLessonId !== String(lessonId)) continue;
    if (userId && rUserId !== String(userId)) continue;
    
    let parsedAns = null;
    try {
      parsedAns = typeof row[4] === 'string' ? JSON.parse(row[4]) : row[4];
    } catch (e) {
      parsedAns = row[4];
    }
    
    answersList.push({
      id: String(row[0]),
      userId: rUserId,
      lessonId: rLessonId,
      submittedAt: row[3],
      answers: parsedAns
    });
  }
  return answersList;
}

function assignLesson(ss, userId, lessonId, adminId) {
  const sheet = ss.getSheetByName('Brain_ManualAssignments') || ss.insertSheet('Brain_ManualAssignments');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'UserID', 'LessonID', 'AdminID', 'AssignedAt']);
  }
  const id = 'asgn_' + Utilities.getUuid();
  const assignedAt = new Date().toISOString();
  sheet.appendRow([id, userId, lessonId, adminId || 'admin', assignedAt]);
  return { id: id, userId: userId, lessonId: lessonId, assignedAt: assignedAt };
}

function batchAssignLessons(ss, userIds, lessonIds, adminId) {
  if (!Array.isArray(userIds) || !Array.isArray(lessonIds)) {
    return { count: 0, message: 'userIds and lessonIds must be arrays' };
  }

  const sheet = ss.getSheetByName('Brain_ManualAssignments') || ss.insertSheet('Brain_ManualAssignments');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'UserID', 'LessonID', 'AdminID', 'AssignedAt']);
  }

  const existingData = sheet.getDataRange().getValues();
  const existingSet = new Set();
  for (let i = 1; i < existingData.length; i++) {
    const uId = String(existingData[i][1]);
    const lId = String(existingData[i][2]);
    existingSet.add(uId + '|' + lId);
  }

  let createdCount = 0;
  const rowsToAdd = [];
  const assignedAt = new Date().toISOString();
  const admin = adminId || 'admin';

  userIds.forEach(function(uId) {
    lessonIds.forEach(function(lId) {
      const pairKey = String(uId) + '|' + String(lId);
      if (!existingSet.has(pairKey)) {
        existingSet.add(pairKey);
        const id = 'asgn_' + Utilities.getUuid();
        rowsToAdd.push([id, String(uId), String(lId), admin, assignedAt]);
        createdCount++;
      }
    });
  });

  if (rowsToAdd.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAdd.length, 5).setValues(rowsToAdd);
  }

  return {
    count: createdCount,
    totalRequested: userIds.length * lessonIds.length,
    usersCount: userIds.length,
    lessonsCount: lessonIds.length
  };
}

function getMyLessons(ss, userId) {
  const asgnSheet = ss.getSheetByName('Brain_ManualAssignments');
  const assignedLessonIds = new Set();
  if (asgnSheet) {
    const asgnData = asgnSheet.getDataRange().getValues();
    for (let i = 1; i < asgnData.length; i++) {
      if (String(asgnData[i][1]) === String(userId)) {
        assignedLessonIds.add(String(asgnData[i][2]));
      }
    }
  }

  const allLessons = getInteractiveLessons(ss);
  if (!asgnSheet || assignedLessonIds.size === 0) {
    return [];
  }
  return allLessons.filter(lesson => assignedLessonIds.has(String(lesson.id)));
}

