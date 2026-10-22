import React, { useState, useEffect } from 'react';
import { Modal, Avatar, Badge, Button, StatusIndicator, LoadingState } from '../UI';
import { useApp } from '../../context/AppContext';
import apiClient from '../../utils/apiClient';

export function RoomFindPartnerModal({ room, isOpen, onClose }) {
  const {
    invitedStudentIds,
    sendStudyInvite,
    setSelectedPartner,
  } = useApp();

  const [peers, setPeers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && room) {
      let isSubscribed = true;
      setIsLoading(true);
      setError(null);

      apiClient
        .getPeerMatches({
          subject: room.subject,
          topic: room.topic,
          limit: 5,
        })
        .then((res) => {
          if (!isSubscribed) return;
          if (res.isAvailable && res.ok && res.data?.success) {
            setPeers(res.data.data || []);
            setError(null);
          } else if (!res.isAvailable) {
            setError('Backend server is offline');
            setPeers([]);
          } else {
            setError(res.data?.error?.message || 'Failed to match peers');
            setPeers([]);
          }
        })
        .catch((err) => {
          if (isSubscribed) {
            setError(err.message || 'Error finding partners');
            setPeers([]);
          }
        })
        .finally(() => {
          if (isSubscribed) setIsLoading(false);
        });

      return () => {
        isSubscribed = false;
      };
    }
  }, [isOpen, room]);

  if (!room) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Find Study Partner for ${room.title || room.room_name}`}
      id="room-find-partner-modal"
      maxWidth={640}
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Showing peers studying {room.topic} scored via StudySync Matching Engine
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)' }}>Topic Room Context:</strong>{' '}
          {room.subject} &bull; {room.topic} ({room.roomType || room.room_type || 'Study Room'})
        </div>

        {isLoading ? (
          <LoadingState message="Retrieving compatible study partners from live records..." />
        ) : error ? (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-danger, #ef4444)',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--color-text-danger, #ef4444)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-2)' }}>
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLoading(true);
                apiClient.getPeerMatches({ subject: room.subject, topic: room.topic, limit: 5 })
                  .then((res) => setPeers(res.data?.data || []))
                  .finally(() => setIsLoading(false));
              }}
            >
              Retry Search
            </Button>
          </div>
        ) : peers.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-4)',
              textAlign: 'center',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              No other active learners found currently matching this specific topic.
            </p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            {peers.map((peer, idx) => {
              const isInvited = invitedStudentIds.has(peer.studentId || peer.id);

              return (
                <div
                  key={peer.studentId || peer.id || idx}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div className="row" style={{ gap: 'var(--space-3)' }}>
                      <Avatar
                        name={peer.studentName || peer.displayName}
                        initials={peer.studentInitials}
                        size="md"
                        status="online"
                      />
                      <div>
                        <div className="row" style={{ gap: 'var(--space-2)' }}>
                          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                            {peer.studentName || peer.displayName}
                          </h4>
                          <Badge variant="accent">
                            {peer.compatibilityScore}% Compatibility
                          </Badge>
                          <Badge variant="neutral">
                            {peer.skillLevel}
                          </Badge>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {peer.headline || `${peer.year} • ${peer.major}`}
                        </p>
                      </div>
                    </div>

                    <StatusIndicator
                      status="active"
                      label={peer.mutualAvailability?.split('(')[0]?.trim() || 'Available now'}
                    />
                  </div>

                  {/* Strengths & Learning */}
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                    <div>
                      <strong style={{ color: 'var(--color-text-primary)' }}>Strong in:</strong>{' '}
                      {Array.isArray(peer.strengths) ? peer.strengths.slice(0, 3).join(', ') : peer.strengths}
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <strong style={{ color: 'var(--color-text-primary)' }}>Currently learning:</strong>{' '}
                      {peer.learningNow}
                    </div>
                  </div>

                  {/* Reason */}
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <strong style={{ color: 'var(--color-text-primary)' }}>Matching Reason:</strong>{' '}
                    {(peer.matchingReasons && peer.matchingReasons[0]) || peer.recommendationReason || 'Strong match for this topic room.'}
                  </div>

                  {/* Actions */}
                  <div className="row-between" style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--color-border-subtle)' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPartner({
                          id: peer.studentId,
                          name: peer.studentName,
                          initials: peer.studentInitials,
                          major: peer.major,
                          year: peer.year,
                          headline: peer.headline,
                          institution: peer.institution,
                          learningNow: peer.learningNowList || [peer.topic],
                          subjects: peer.subjects,
                          skillLevel: peer.skillLevel,
                          availability: peer.mutualAvailability,
                          preferredLanguages: peer.preferredLanguages,
                          strengths: peer.strengths,
                          currentRoomId: peer.connectedRoomId,
                          compatibilityScore: peer.compatibilityScore,
                          bio: peer.bio,
                        });
                      }}
                    >
                      View Profile
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isInvited}
                      onClick={() => sendStudyInvite(peer.studentId || peer.id, room.topic)}
                    >
                      {isInvited ? 'Invitation Sent \u2713' : 'Invite to Study'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default RoomFindPartnerModal;
