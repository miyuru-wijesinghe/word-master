# Testing Guide - Firestore Implementation & Fixes

## ✅ Fixes Implemented

### 1. Timer Freeze & Empty Result Issues - FIXED
**Problem:** Timer would freeze and empty results would appear, data not passing correctly between screens.

**Solution:**
- Added comprehensive data validation before broadcasting messages
- All `selectedEntries` mappings now validate:
  - Index bounds checking
  - Quiz data existence
  - Word field presence
  - Team field fallback to empty string
- Added logging for debugging data flow
- Fixed all message broadcast points to ensure valid data

**Files Modified:**
- `src/pages/ActionPage.tsx` - All message broadcasting functions now validate data

### 2. Delete Quiz Functionality - ADDED
**Feature:** Users can now delete entire quizzes with all their entries.

**Implementation:**
- Added "Delete Quiz" button in quiz management section
- Confirmation dialog before deletion
- Automatically clears selection and refreshes quiz list after deletion
- Deletes all entries in the quiz before deleting the quiz document

**Files Modified:**
- `src/pages/ActionPage.tsx` - Added `handleDeleteQuiz` function and UI button

## 🧪 Testing Checklist

### Prerequisites
1. Ensure dev server is running: `npm run dev`
2. Open browser to `http://localhost:5173`
3. Open browser console (F12) to see logs

### Test 1: Create Quiz
- [ ] Navigate to Control Panel (`/action`)
- [ ] Click "Create Quiz" button
- [ ] Enter quiz name (e.g., "Test Quiz 1")
- [ ] Click "Create"
- [ ] Verify quiz appears in dropdown
- [ ] Verify quiz is automatically selected

### Test 2: Add Entries
- [ ] With quiz selected, click "Add Entry"
- [ ] Fill in form:
  - Team: "Team A"
  - Word: "TestWord" (required)
  - Other fields (optional)
- [ ] Click "Add"
- [ ] Verify entry appears in table
- [ ] Add 2-3 more entries with different words

### Test 3: Edit Entry
- [ ] Click edit icon (✏️) on an entry
- [ ] Modify some fields
- [ ] Click "Update"
- [ ] Verify changes appear in table

### Test 4: Delete Entry
- [ ] Click delete icon (🗑️) on an entry
- [ ] Confirm deletion
- [ ] Verify entry is removed from table

### Test 5: Excel Import
- [ ] Select a quiz (or create new one)
- [ ] Click "Import Excel"
- [ ] Upload an Excel file with quiz data
- [ ] Verify entries are imported
- [ ] Verify entries appear in table
- [ ] Verify all entries have correct data

### Test 6: Delete Quiz
- [ ] Select a quiz with entries
- [ ] Click "Delete Quiz" button
- [ ] Confirm deletion in dialog
- [ ] Verify quiz is removed from dropdown
- [ ] Verify table is cleared
- [ ] Verify no errors in console

### Test 7: Timer Functionality (Critical)
- [ ] Select an entry from table
- [ ] Navigate to Manage Screen (`/manage`)
- [ ] Verify selected entry appears
- [ ] Select duration (30s or 2m)
- [ ] Click "Play" button
- [ ] Verify timer starts counting down
- [ ] Navigate to View Screen (`/view`)
- [ ] Verify timer is displayed and counting
- [ ] Verify word is displayed
- [ ] Wait for timer to complete OR click pause
- [ ] Verify timer stops correctly
- [ ] Verify no empty results appear
- [ ] Verify data passes correctly between screens

### Test 8: Real-Time Updates
- [ ] Open two browser tabs
- [ ] Both tabs: Navigate to Control Panel
- [ ] Tab 1: Create a quiz
- [ ] Tab 2: Verify quiz appears automatically
- [ ] Tab 1: Add an entry
- [ ] Tab 2: Verify entry appears automatically
- [ ] Tab 1: Edit an entry
- [ ] Tab 2: Verify changes appear automatically
- [ ] Tab 1: Delete an entry
- [ ] Tab 2: Verify entry disappears automatically

### Test 9: Data Validation (Timer Fix)
- [ ] Create quiz with entries
- [ ] Select an entry
- [ ] Start timer
- [ ] Check browser console - should see logs like:
  - "ActionPage: Sent start message: { word: '...', entries: [...] }"
  - "ActionPage: Sent timer update: { word: '...', entries: [...] }"
- [ ] Verify no errors about invalid data
- [ ] Verify timer doesn't freeze
- [ ] Verify word and entries are always present in messages

### Test 10: Edge Cases
- [ ] Try to delete quiz with no entries
- [ ] Try to add entry without word (should show error)
- [ ] Try to select entry when quiz data is empty
- [ ] Try to start timer without selecting entry
- [ ] Try to edit/delete when no quiz selected
- [ ] Verify all error messages are user-friendly

## 🔍 Debugging Tips

### If Timer Freezes:
1. Check browser console for errors
2. Look for logs starting with "ActionPage:"
3. Verify `selectedEntries` array is not empty
4. Verify `word` field is present in messages
5. Check that `quizData` is not empty

### If Empty Results Appear:
1. Check that entry has valid `Word` field
2. Verify quiz data loaded correctly
3. Check console for validation warnings
4. Ensure entry is properly selected before starting timer

### If Data Doesn't Pass Between Screens:
1. Check Firebase connection status
2. Verify BroadcastChannel is working (same device)
3. Check console for message sending/receiving logs
4. Verify message structure includes all required fields

## 📊 Expected Console Logs

When working correctly, you should see:
```
Firebase initialized successfully (Realtime DB + Firestore)
Firestore: Created quiz: [quizId]
Firestore: Added entry: [entryId] to quiz: [quizId]
ActionPage: Sent selection update: { word: '...', entries: [...] }
ActionPage: Sent start message: { word: '...', entries: [...] }
ActionPage: Sent timer update: { word: '...', entries: [...] }
```

## ⚠️ Common Issues & Solutions

### Issue: "Cannot read property 'Word' of undefined"
**Solution:** Data validation now prevents this. If it still occurs, check that quiz data loaded correctly.

### Issue: Timer freezes at specific time
**Solution:** Check that `isRunningRef` and `isPausedRef` are being updated correctly. Fixed in latest update.

### Issue: Empty selectedEntries in messages
**Solution:** All message broadcasts now validate data before sending. Empty arrays are only sent when intentionally clearing selection.

## ✅ Success Criteria

All tests should pass with:
- ✅ No console errors
- ✅ Timer runs smoothly without freezing
- ✅ Data passes correctly between all screens
- ✅ No empty results appear
- ✅ Real-time updates work across tabs
- ✅ All CRUD operations work correctly

---

**Last Updated:** After timer freeze fix and delete quiz implementation
**Status:** Ready for testing



