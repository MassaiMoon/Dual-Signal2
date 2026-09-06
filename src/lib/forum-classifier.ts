/**
 * Governance Forum activity classifier.
 *
 * Determines activity type and points for a Discourse post,
 * applying anti-gaming rules (comment cap per topic).
 *
 * No DB access, no HTTP — pure functions only.
 */

import {
  GOVERNANCE_ACTIVITY_POINTS,
  GOVERNANCE_COMMENT_POINTS_CAP,
  GOVERNANCE_PROPOSAL_CATEGORY_IDS,
} from './config';

export type ActivityType = 'COMMENT' | 'TOPIC_CREATED' | 'FORMAL_PROPOSAL' | 'POLL_PARTICIPATION';

export interface ClassifiedActivity {
  activityType:  ActivityType;
  pointsAwarded: number;
}

/**
 * Determine whether a post in a topic is the topic-opener (post_number === 1).
 */
export function isTopicOpener(postNumber: number): boolean {
  return postNumber === 1;
}

/**
 * Classify a post and compute points.
 *
 * @param postNumber  Discourse post_number (1 = topic opener)
 * @param categoryId  Discourse category_id (used to distinguish FORMAL_PROPOSAL)
 * @param existingCommentPoints  Points already awarded to this user in this topic
 *                               (used for anti-gaming cap). Pass 0 if first comment.
 */
export function classifyPost(
  postNumber:            number,
  categoryId:            number,
  existingCommentPoints: number,
): ClassifiedActivity | null {
  if (isTopicOpener(postNumber)) {
    // Topic opener: FORMAL_PROPOSAL or TOPIC_CREATED depending on category
    const isFormal = (GOVERNANCE_PROPOSAL_CATEGORY_IDS as readonly number[]).includes(categoryId);
    return {
      activityType:  isFormal ? 'FORMAL_PROPOSAL' : 'TOPIC_CREATED',
      pointsAwarded: isFormal
        ? GOVERNANCE_ACTIVITY_POINTS.formalProposal
        : GOVERNANCE_ACTIVITY_POINTS.topicCreated,
    };
  }

  // Reply/comment — apply anti-gaming cap
  if (existingCommentPoints >= GOVERNANCE_COMMENT_POINTS_CAP) {
    return null; // user already hit the cap for this topic, skip
  }

  const isFirst     = existingCommentPoints === 0;
  const points      = isFirst
    ? GOVERNANCE_ACTIVITY_POINTS.firstComment
    : GOVERNANCE_ACTIVITY_POINTS.additionalComment;

  // Clamp so we never exceed the cap in a single award
  const capped = Math.min(points, GOVERNANCE_COMMENT_POINTS_CAP - existingCommentPoints);

  return {
    activityType:  'COMMENT',
    pointsAwarded: capped,
  };
}

/**
 * Sum all points for a given badge across activities to get a governance level.
 * Used by sync to aggregate from DB rows.
 */
export function sumActivityPoints(
  activities: Array<{ pointsAwarded: number }>,
): number {
  return activities.reduce((acc, a) => acc + a.pointsAwarded, 0);
}
