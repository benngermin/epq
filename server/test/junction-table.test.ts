#!/usr/bin/env tsx
/**
 * Tests for the new junction table functionality
 * Tests the many-to-many relationship between courses and question sets
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Storage } from '../storage';
import { courses, courseQuestionSets, questionSets } from '../../shared/schema';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

describe('Junction Table Functionality', () => {
  let storage: Storage;
  let connection: postgres.Sql;
  let testCourseIds: number[] = [];
  let testQuestionSetIds: number[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL not set');
    }

    connection = postgres(databaseUrl);
    const db = drizzle(connection);
    storage = new Storage();
  });

  afterAll(async () => {
    // Clean up test data
    for (const courseId of testCourseIds) {
      await storage.deleteCourse(courseId);
    }
    for (const questionSetId of testQuestionSetIds) {
      await storage.deleteQuestionSet(questionSetId);
    }
    await connection.end();
  });

  beforeEach(async () => {
    // Clear any existing test data before each test
    testCourseIds = [];
    testQuestionSetIds = [];
  });

  it('should create courses with baseCourseNumber', async () => {
    const aiCourse = await storage.createCourse({
      courseNumber: 'TEST 101 (AI)',
      courseTitle: 'Test Course AI Version',
      isAi: true,
      baseCourseNumber: 'TEST 101'
    });

    const nonAiCourse = await storage.createCourse({
      courseNumber: 'TEST 101 (Non-AI)',
      courseTitle: 'Test Course Non-AI Version',
      isAi: false,
      baseCourseNumber: 'TEST 101'
    });

    testCourseIds.push(aiCourse.id, nonAiCourse.id);

    expect(aiCourse.baseCourseNumber).toBe('TEST 101');
    expect(nonAiCourse.baseCourseNumber).toBe('TEST 101');
    expect(aiCourse.isAi).toBe(true);
    expect(nonAiCourse.isAi).toBe(false);
  });

  it('should create question sets without courseId', async () => {
    const questionSet = await storage.createQuestionSet({
      title: 'Shared Test Question Set',
      description: 'A test question set that can be shared across courses',
    });

    testQuestionSetIds.push(questionSet.id);

    expect(questionSet.title).toBe('Shared Test Question Set');
    expect(questionSet.description).toBe('A test question set that can be shared across courses');
    // Ensure no courseId field exists (would cause TypeScript error if it did)
    expect('courseId' in questionSet).toBe(false);
  });

  it('should create and manage course-questionset mappings', async () => {
    // Create test data
    const course1 = await storage.createCourse({
      courseNumber: 'TEST 201 (AI)',
      courseTitle: 'Test Course 1',
      isAi: true,
      baseCourseNumber: 'TEST 201'
    });

    const course2 = await storage.createCourse({
      courseNumber: 'TEST 201 (Non-AI)',
      courseTitle: 'Test Course 2',
      isAi: false,
      baseCourseNumber: 'TEST 201'
    });

    const questionSet = await storage.createQuestionSet({
      title: 'Shared Question Set Test',
      description: 'Testing shared functionality',
    });

    testCourseIds.push(course1.id, course2.id);
    testQuestionSetIds.push(questionSet.id);

    // Create mappings
    const mapping1 = await storage.createCourseQuestionSetMapping(course1.id, questionSet.id, 1);
    const mapping2 = await storage.createCourseQuestionSetMapping(course2.id, questionSet.id, 2);

    expect(mapping1.courseId).toBe(course1.id);
    expect(mapping1.questionSetId).toBe(questionSet.id);
    expect(mapping1.displayOrder).toBe(1);

    expect(mapping2.courseId).toBe(course2.id);
    expect(mapping2.questionSetId).toBe(questionSet.id);
    expect(mapping2.displayOrder).toBe(2);

    // Test getting question sets by course
    const course1QuestionSets = await storage.getQuestionSetsByCourse(course1.id);
    const course2QuestionSets = await storage.getQuestionSetsByCourse(course2.id);

    expect(course1QuestionSets).toHaveLength(1);
    expect(course2QuestionSets).toHaveLength(1);
    expect(course1QuestionSets[0].id).toBe(questionSet.id);
    expect(course2QuestionSets[0].id).toBe(questionSet.id);

    // Test getting courses for a question set
    const coursesForQuestionSet = await storage.getCoursesForQuestionSet(questionSet.id);
    expect(coursesForQuestionSet).toHaveLength(2);
    expect(coursesForQuestionSet.map(c => c.id).sort()).toEqual([course1.id, course2.id].sort());

    // Test removing mapping
    const removed = await storage.removeCourseQuestionSetMapping(course1.id, questionSet.id);
    expect(removed).toBe(true);

    // Verify mapping was removed
    const updatedCourse1QuestionSets = await storage.getQuestionSetsByCourse(course1.id);
    const updatedCoursesForQuestionSet = await storage.getCoursesForQuestionSet(questionSet.id);

    expect(updatedCourse1QuestionSets).toHaveLength(0);
    expect(updatedCoursesForQuestionSet).toHaveLength(1);
    expect(updatedCoursesForQuestionSet[0].id).toBe(course2.id);
  });

  it('should get courses by base course number', async () => {
    const baseCourseNumber = 'TEST 301';

    const aiCourse = await storage.createCourse({
      courseNumber: 'TEST 301 (AI)',
      courseTitle: 'Test Base Course AI',
      isAi: true,
      baseCourseNumber
    });

    const nonAiCourse = await storage.createCourse({
      courseNumber: 'TEST 301 (Non-AI)',
      courseTitle: 'Test Base Course Non-AI',
      isAi: false,
      baseCourseNumber
    });

    testCourseIds.push(aiCourse.id, nonAiCourse.id);

    const coursesByBase = await storage.getCoursesByBaseCourseNumber(baseCourseNumber);

    expect(coursesByBase).toHaveLength(2);
    
    // Should be sorted by isAi (false first, then true)
    expect(coursesByBase[0].isAi).toBe(false);
    expect(coursesByBase[1].isAi).toBe(true);
    
    coursesByBase.forEach(course => {
      expect(course.baseCourseNumber).toBe(baseCourseNumber);
    });
  });

  it('should handle duplicate mapping prevention', async () => {
    const course = await storage.createCourse({
      courseNumber: 'TEST 401',
      courseTitle: 'Duplicate Test Course',
      isAi: true,
      baseCourseNumber: 'TEST 401'
    });

    const questionSet = await storage.createQuestionSet({
      title: 'Duplicate Test Question Set',
    });

    testCourseIds.push(course.id);
    testQuestionSetIds.push(questionSet.id);

    // Create first mapping
    const mapping1 = await storage.createCourseQuestionSetMapping(course.id, questionSet.id);
    expect(mapping1.courseId).toBe(course.id);

    // Try to create duplicate mapping - should throw error due to unique constraint
    await expect(
      storage.createCourseQuestionSetMapping(course.id, questionSet.id)
    ).rejects.toThrow();
  });

  it('should maintain referential integrity', async () => {
    const course = await storage.createCourse({
      courseNumber: 'TEST 501',
      courseTitle: 'Referential Test Course',
      isAi: true,
      baseCourseNumber: 'TEST 501'
    });

    const questionSet = await storage.createQuestionSet({
      title: 'Referential Test Question Set',
    });

    testCourseIds.push(course.id);
    testQuestionSetIds.push(questionSet.id);

    // Create mapping
    await storage.createCourseQuestionSetMapping(course.id, questionSet.id);

    // Try to delete course with existing mappings - should fail
    const deleted = await storage.deleteCourse(course.id);
    expect(deleted).toBe(false); // Should fail due to foreign key constraint

    // Remove mapping first, then delete should work
    await storage.removeCourseQuestionSetMapping(course.id, questionSet.id);
    const deletedAfterCleanup = await storage.deleteCourse(course.id);
    expect(deletedAfterCleanup).toBe(true);

    // Remove from testCourseIds since we manually deleted it
    testCourseIds = testCourseIds.filter(id => id !== course.id);
  });
});