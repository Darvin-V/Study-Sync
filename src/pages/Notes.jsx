import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Section,
  Card,
  Badge,
  Button,
  SearchField,
  Tabs,
  Avatar,
  EmptyState,
  LockIcon,
  UsersIcon,
  GlobeIcon,
  BookOpenIcon,
  PlusIcon,
} from '../components';
import { useApp } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';

export function Notes() {
  const [searchParams] = useSearchParams();
  const { t } = usePreferences();
  const noteIdFromUrl = searchParams.get('note');

  const {
    notes,
    isNotesLoading,
    notesError,
    loadNotes,
    deleteNote,
    setSelectedNote,
    setIsCreateNoteOpen,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (noteIdFromUrl && notes.length > 0) {
      const match = notes.find((n) => n.id === noteIdFromUrl);
      if (match) setSelectedNote(match);
    }
  }, [noteIdFromUrl, notes, setSelectedNote]);

  const handleDelete = async (noteId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    setDeletingId(noteId);
    try {
      await deleteNote(noteId);
    } finally {
      setDeletingId(null);
    }
  };

  const distinctSubjects = Array.from(
    new Set(notes.map((n) => n.subject).filter(Boolean))
  );
  const subjectTabs = [
    { id: 'all', label: 'All Subjects', count: notes.length },
    ...distinctSubjects.map((subj) => ({
      id: subj,
      label: subj,
      count: notes.filter((n) => (n.subject || '').toLowerCase() === subj.toLowerCase()).length,
    })),
  ];

  const typePills = [
    { id: 'all', label: 'All Types' },
    { id: 'Lecture Summary', label: 'Lecture Summary' },
    { id: 'Worked Examples', label: 'Worked Examples' },
    { id: 'Cheatsheet', label: 'Cheatsheet' },
    { id: 'Revision Brief', label: 'Revision Brief' },
  ];

  const filteredNotes = notes.filter((note) => {
    const titleMatch = (note.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (note.description || note.excerpt || '').toLowerCase().includes(searchQuery.toLowerCase());
    const topicMatch = (note.topic || '').toLowerCase().includes(searchQuery.toLowerCase());
    const subjectMatch = (note.subject || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = titleMatch || descMatch || topicMatch || subjectMatch;

    const matchesSubject =
      selectedSubject === 'all' || (note.subject || '').toLowerCase() === selectedSubject.toLowerCase();

    const matchesType =
      selectedType === 'all' || (note.type || note.resource_type) === selectedType;

    return matchesSearch && matchesSubject && matchesType;
  });

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }} id="notes-page">
      {/* Page Header */}
      <header className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }} id="notes-page-header">
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            {t('notes.title', 'Notes')}
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {t('notes.subtitle', 'Shared study summaries, cheat sheets, and revision briefs.')}
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadNotes()}
            disabled={isNotesLoading}
            id="btn-refresh-notes"
          >
            {isNotesLoading ? t('common.loading', 'Refreshing...') : `↻ ${t('common.retry', 'Refresh')}`}
          </Button>

          <Button
            variant="primary"
            id="btn-upload-note"
            onClick={() => setIsCreateNoteOpen(true)}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            {t('notes.createBtn', 'Create Note')}
          </Button>
        </div>
      </header>

      {/* Filter and Search Controls */}
      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr auto', gap: 'var(--space-4)' }}>
          <SearchField
            placeholder={t('notes.searchPlaceholder', 'Search notes by title, topic, or concept...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="notes-search-input"
          />

          <Tabs
            tabs={typePills}
            activeTab={selectedType}
            onChange={setSelectedType}
            variant="pills"
            id="notes-type-tabs"
          />
        </div>

        <Tabs
          tabs={subjectTabs}
          activeTab={selectedSubject}
          onChange={setSelectedSubject}
          variant="underline"
          id="notes-subject-tabs"
        />
      </div>

      {/* Loading State */}
      {isNotesLoading && notes.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 'var(--space-8)' }} id="notes-loading-state">
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            Loading notes...
          </div>
        </Card>
      )}

      {/* Error State */}
      {notesError && !isNotesLoading && (
        <Card style={{ backgroundColor: 'var(--color-danger-subtle)', borderColor: 'var(--color-danger-border)', padding: 'var(--space-4)' }} id="notes-error-state">
          <div className="row-between" style={{ alignItems: 'center' }}>
            <div>
              <strong style={{ color: 'var(--color-danger)' }}>Error loading notes:</strong>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', marginTop: 2 }}>
                {notesError}
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => loadNotes()} id="btn-retry-notes">
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Notes Grid */}
      {!isNotesLoading && !notesError && (
        <Section id="notes-list-section">
          {filteredNotes.length > 0 ? (
            <div className="cards-grid-2" id="notes-grid">
              {filteredNotes.map((note) => (
                <Card key={note.id} id={`note-card-${note.id}`} className="stack-sm" style={{ justifyContent: 'space-between' }}>
                  <div className="stack-sm">
                    <div className="row-between" style={{ alignItems: 'flex-start' }}>
                      <div>
                        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span className="room-topic-badge">
                            {note.subject}
                          </span>
                          {note.topic && (
                            <>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>&bull;</span>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                                {note.topic}
                              </span>
                            </>
                          )}
                          {note.visibility && (
                            <Badge variant={note.visibility === 'private' ? 'warning' : note.visibility === 'room_shared' ? 'accent' : 'neutral'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', padding: '2px 8px' }}>
                              {note.visibility === 'private' ? (
                                <>
                                  <LockIcon size={11} />
                                  <span>Private</span>
                                </>
                              ) : note.visibility === 'room_shared' ? (
                                <>
                                  <UsersIcon size={11} />
                                  <span>Room Shared</span>
                                </>
                              ) : (
                                <>
                                  <GlobeIcon size={11} />
                                  <span>Public</span>
                                </>
                              )}
                            </Badge>
                          )}
                        </div>
                        <h3 className="card-title" style={{ fontSize: 'var(--text-base)', marginTop: 6 }}>
                          {note.title}
                        </h3>
                      </div>
                      <Badge variant="sage" style={{ fontSize: '11px', padding: '2px 8px' }}>
                        {note.type || note.resource_type || 'Note'}
                      </Badge>
                    </div>

                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0' }}>
                      {note.description || note.excerpt}
                    </p>

                    {note.room_name && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Linked Room: <strong>{note.room_name}</strong>
                      </div>
                    )}
                  </div>

                  <div className="card-footer" style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
                    <div className="row" style={{ gap: 'var(--space-2)' }}>
                      <Avatar name={note.author} initials={note.authorInitials || (note.author ? note.author[0] : 'U')} size="xs" />
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                        {note.author} &bull; {note.updatedAt || 'Recently'}
                      </span>
                    </div>

                    <div className="row" style={{ gap: 'var(--space-2)' }}>
                      {note.isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          style={{ color: 'var(--color-danger)', fontSize: '11px', padding: '2px 8px' }}
                          onClick={(e) => handleDelete(note.id, e)}
                          disabled={deletingId === note.id}
                        >
                          {deletingId === note.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        id={`read-note-${note.id}`}
                        onClick={() => setSelectedNote(note)}
                      >
                        {t('notes.viewNote', 'Read Note')}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('notes.emptyTitle', 'No matching notes found')}
              description={t('notes.emptySub', "Try selecting 'All Subjects' or clearing your search term, or author a new note for your peers.")}
              id="notes-empty-state"
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateNoteOpen(true)}
                >
                  {t('notes.createBtn', 'Create Note Now')}
                </Button>
              }
            />
          )}
        </Section>
      )}
    </div>
  );
}

export default Notes;

