const supabaseModule = require('../config/database');
const supabaseAdmin = supabaseModule.admin;
const { v4: uuidv4 } = require('uuid');

class EmployeeChatService {
  /**
   * Create a new chat session
   */
  static async createChatSession(employeeId, mobileNumber, campaignId, jobCategoryId) {
    try {
      const sessionToken = this.generateSessionToken();

      const { data, error } = await supabaseAdmin
        .from('chat_sessions')
        .insert([{
          employee_id: employeeId,
          mobile_number: mobileNumber,
          campaign_id: campaignId,
          job_category_id: jobCategoryId,
          session_token: sessionToken,
          session_status: 'active'
        }])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  /**
   * Send a message in chat session
   */
  static async sendMessage(sessionId, employeeId, messageText, messageType = 'text', mediaUrl = null, senderType = 'employee', fileMetadata = null) {
    try {
      const messageData = {
        session_id: sessionId,
        employee_id: employeeId,
        message_text: messageText,
        message_type: messageType,
        media_url: mediaUrl,
        sender_type: senderType
      };

      // Add file metadata if provided (for file messages) - store as JSON object, not string
      if (fileMetadata) {
        messageData.file_metadata = fileMetadata; // Pass as object, Supabase will handle JSONB conversion
      }

      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .insert([messageData])
        .select();

      if (error) throw error;

      // Update session with message count and last message time
      await this.updateSessionActivity(sessionId);

      return data[0];
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get chat session history
   */
  static async getSessionMessages(sessionId, limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('chat_messages')
        .select('*', { count: 'exact' })
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data: data.reverse(), count };
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Update session activity
   */
  static async updateSessionActivity(sessionId) {
    try {
      // Get current message count
      const { count } = await supabaseAdmin
        .from('chat_messages')
        .select('*', { count: 'exact' })
        .eq('session_id', sessionId);

      const { error } = await supabaseAdmin
        .from('chat_sessions')
        .update({
          last_message_at: new Date().toISOString(),
          message_count: count
        })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating session activity:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  static async markMessagesAsRead(sessionId, employeeId) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .neq('employee_id', employeeId)
        .is('read_at', null)
        .select('id', { count: 'exact' });

      if (error) throw error;
      return { messages_marked_read: count || 0 };
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Get active sessions for employee
   */
  static async getEmployeeSessions(employeeId, limit = 20, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('chat_sessions')
        .select(
          `id, employee_id, mobile_number, campaign_id, 
           job_category_id, session_status, last_message_at, 
           message_count, started_at,
           campaigns:campaign_id(id, name),
           job_categories:job_category_id(id, name)`,
          { count: 'exact' }
        )
        .eq('employee_id', employeeId)
        .eq('session_status', 'active')
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data, count };
    } catch (error) {
      console.error('Error fetching employee sessions:', error);
      throw error;
    }
  }

  /**
   * Close chat session
   */
  static async closeSession(sessionId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('chat_sessions')
        .update({
          session_status: 'archived',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error closing session:', error);
      throw error;
    }
  }

  /**
   * Get unread message count
   */
  static async getUnreadCount(sessionId, employeeId) {
    try {
      const { count, error } = await supabaseAdmin
        .from('chat_messages')
        .select('*', { count: 'exact' })
        .eq('session_id', sessionId)
        .neq('employee_id', employeeId)
        .is('read_at', null);

      if (error) throw error;
      return count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  }

  /**
   * Generate session token
   */
  static generateSessionToken() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get employee by mobile number for chat lookup
   */
  static async getEmployeeByMobileForChat(mobileNumber) {
    try {
      const { data, error } = await supabaseAdmin
        .from('employee_job_mobile_mapping')
        .select(
          `id, employee_id, mobile_number, chat_enabled, 
           job_category_id, job_industry_id, device_token`
        )
        .eq('mobile_number', mobileNumber)
        .eq('chat_enabled', true)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error fetching employee by mobile:', error);
      throw error;
    }
  }

  /**
   * Get total unread messages across all sessions
   */
  static async getTotalUnreadMessages(employeeId) {
    try {
      // Get all sessions for employee
      const { data: sessions, error: sessionsError } = await supabaseAdmin
        .from('chat_sessions')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('session_status', 'active');

      if (sessionsError) throw sessionsError;

      if (!sessions || sessions.length === 0) return 0;

      const sessionIds = sessions.map(s => s.id);

      // Count unread messages across all sessions
      const { count, error } = await supabaseAdmin
        .from('chat_messages')
        .select('*', { count: 'exact' })
        .in('session_id', sessionIds)
        .neq('employee_id', employeeId)
        .is('read_at', null);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error fetching total unread:', error);
      throw error;
    }
  }

  /**
   * Archive old inactive sessions (older than 30 days)
   */
  static async archiveInactiveSessions(daysOld = 30) {
    try {
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - daysOld);

      const { data, error } = await supabaseAdmin
        .from('chat_sessions')
        .update({
          session_status: 'archived',
          ended_at: new Date().toISOString()
        })
        .eq('session_status', 'active')
        .lt('last_message_at', archiveDate.toISOString())
        .select();

      if (error) throw error;
      return { archived_count: data.length };
    } catch (error) {
      console.error('Error archiving inactive sessions:', error);
      throw error;
    }
  }

  /**
   * Get most recent active session or create one if none exists
   */
  static async getOrCreateChatSession(employeeId, mobileNumber, campaignId, jobCategoryId) {
    try {
      // First, try to get the most recent active session for this employee
      const { data: existingSessions, error: getError } = await supabaseAdmin
        .from('chat_sessions')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('session_status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (getError) throw getError;

      // If an active session exists, return the most recent one
      if (existingSessions && existingSessions.length > 0) {
        return {
          session: existingSessions[0],
          created: false,
          message: 'Existing active session found'
        };
      }

      // If no active session exists, create a new one
      if (!mobileNumber) {
        throw new Error('Mobile number is required to create a new chat session');
      }

      const sessionToken = this.generateSessionToken();

      const { data: newSession, error: createError } = await supabaseAdmin
        .from('chat_sessions')
        .insert([{
          employee_id: employeeId,
          mobile_number: mobileNumber,
          campaign_id: campaignId || null,
          job_category_id: jobCategoryId || null,
          session_token: sessionToken,
          session_status: 'active'
        }])
        .select();

      if (createError) throw createError;

      return {
        session: newSession[0],
        created: true,
        message: 'New chat session created'
      };
    } catch (error) {
      console.error('Error in getOrCreateChatSession:', error);
      throw error;
    }
  }
}

module.exports = EmployeeChatService;
