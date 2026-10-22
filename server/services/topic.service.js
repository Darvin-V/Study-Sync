import TopicModel from '../models/topic.model.js';

/**
 * StudySync AI — Topic Service
 * 
 * Business logic layer for syllabus topics and subjects.
 */
export const TopicService = {
  async getTopics(filters = {}) {
    const topics = TopicModel.findAll(filters);
    return {
      items: topics,
      count: topics.length,
      filtersApplied: filters,
    };
  },

  async getTopicById(id) {
    return TopicModel.findById(id);
  },

  async getSubjects() {
    return TopicModel.findAllSubjects();
  },
};

export default TopicService;
