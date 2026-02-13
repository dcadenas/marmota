import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { useGroups } from '@/hooks/use-groups';
import { useMessages } from '@/hooks/use-messages';
import { useSendMessage } from '@/hooks/use-send-message';
import { useReadState } from '@/hooks/use-read-state';
import { useMarmotSubscription } from '@/hooks/use-marmot-subscription';
import { useConnectionStatus } from '@/hooks/use-connection-status';
import { useWebNotifications } from '@/hooks/use-web-notifications';
import { ProfilePic, DisplayName, ClickableProfile } from '@/components/profile';
import { AccountMenu } from '@/components/AccountMenu';
import { MessageContent } from '@/components/content';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { CreateGroupDialog } from '@/components/CreateGroupDialog';
import { GroupSettingsPanel } from '@/components/GroupSettingsPanel';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { db } from '@/lib/storage/database';
import type { StoredGroup, StoredMessage } from '@/lib/storage/database';
import type { MarmotGroup } from 'marmot-ts';
import { getGroupMembers } from 'marmot-ts';

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function shouldShowTimestamp(
  current: StoredMessage,
  next: StoredMessage | undefined,
): boolean {
  if (!next) return true;
  if (next.senderPubkey !== current.senderPubkey) return true;
  return next.createdAt - current.createdAt > 300;
}

/** Determine display info for a group: name and other member for 1:1 */
function useGroupDisplay(marmotGroup: MarmotGroup | null, storedGroup: StoredGroup | null, myPubkey: string) {
  if (!storedGroup) return { name: 'Unknown', otherPubkey: null, is1on1: false };

  const members = marmotGroup ? getGroupMembers(marmotGroup.state) : storedGroup.members;
  const otherMembers = members.filter((p) => p !== myPubkey);
  const is1on1 = members.length === 2 && !storedGroup.name;

  return {
    name: storedGroup.name || (is1on1 && otherMembers[0] ? '' : 'Group'),
    otherPubkey: is1on1 ? otherMembers[0] ?? null : null,
    is1on1,
    memberCount: members.length,
  };
}

// ─── Group List Item ────────────────────────────────────────────
function GroupItem({
  storedGroup,
  marmotGroup,
  myPubkey,
  isSelected,
  isUnread,
  onClick,
}: {
  storedGroup: StoredGroup;
  marmotGroup: MarmotGroup | null;
  myPubkey: string;
  isSelected: boolean;
  isUnread: boolean;
  onClick: () => void;
}) {
  const { name, otherPubkey, is1on1 } = useGroupDisplay(marmotGroup, storedGroup, myPubkey);

  return (
    <button
      onClick={onClick}
      data-testid={`group-${storedGroup.id}`}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-150 ${
        isSelected
          ? 'bg-gray-800/70 border border-gray-700/40'
          : 'border border-transparent hover:bg-gray-800/30'
      }`}
    >
      {is1on1 && otherPubkey ? (
        <ProfilePic pubkey={otherPubkey} />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600/30 text-sm text-indigo-300">
          {(name || 'G')[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-sm ${
              isUnread
                ? 'font-semibold text-gray-100'
                : `font-medium ${isSelected ? 'text-gray-100' : 'text-gray-300'}`
            }`}
          >
            {is1on1 && otherPubkey ? <DisplayName pubkey={otherPubkey} /> : name}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {storedGroup.lastMessage && (
              <span
                className={`text-[10px] ${isUnread ? 'text-indigo-400' : 'text-gray-600'}`}
              >
                {formatTime(storedGroup.lastMessage.createdAt)}
              </span>
            )}
            {isUnread && <span data-testid="unread-dot" className="h-2.5 w-2.5 rounded-full bg-indigo-500" />}
          </div>
        </div>
        {storedGroup.lastMessage && (
          <p
            className={`mt-0.5 truncate text-xs ${
              isUnread ? 'text-gray-300' : 'text-gray-500'
            }`}
          >
            {storedGroup.lastMessage.senderPubkey === myPubkey && (
              <span className="text-gray-600">You: </span>
            )}
            {storedGroup.lastMessage.content}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────
function MessageBubble({
  message,
  isMine,
  showSender,
  showTimestamp,
  isFirstInGroup,
  isGroupChat,
}: {
  message: StoredMessage;
  isMine: boolean;
  showSender: boolean;
  showTimestamp: boolean;
  isFirstInGroup: boolean;
  isGroupChat: boolean;
}) {
  return (
    <div
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${
        isFirstInGroup ? '' : 'mt-0.5'
      }`}
    >
      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
        {showSender && !isMine && isGroupChat && (
          <p className="mb-1 ml-1 text-[10px] text-gray-500">
            <DisplayName pubkey={message.senderPubkey} />
          </p>
        )}
        <div
          className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
            isMine
              ? 'bg-indigo-500 text-white rounded-br-md'
              : 'bg-gray-800/80 text-gray-200 border border-gray-700/30 rounded-bl-md'
          }`}
        >
          <MessageContent content={message.content} isMine={isMine} />
        </div>
        {showTimestamp && (
          <p
            className={`mt-0.5 flex items-center gap-1 text-[10px] text-gray-600 ${
              isMine ? 'justify-end mr-1' : 'ml-1'
            }`}
          >
            {formatTime(message.createdAt)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Message Area ───────────────────────────────────────────────
function MessageArea({
  groupId,
  myPubkey,
  isGroupChat,
}: {
  groupId: string;
  myPubkey: string;
  isGroupChat: boolean;
}) {
  const { data: messages = [] } = useMessages(groupId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div data-testid="message-list" className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-600">No messages yet. Say hello.</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} data-testid="message-list" className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const showSender = !prev || prev.senderPubkey !== msg.senderPubkey;
        const isFirstInGroup = !prev || prev.senderPubkey !== msg.senderPubkey;
        const showTimestamp = shouldShowTimestamp(msg, next);
        return (
          <div key={msg.id} className={isFirstInGroup && i > 0 ? 'mt-3' : ''}>
            <MessageBubble
              message={msg}
              isMine={msg.senderPubkey === myPubkey}
              showSender={showSender}
              showTimestamp={showTimestamp}
              isFirstInGroup={isFirstInGroup}
              isGroupChat={isGroupChat}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Compose Area ───────────────────────────────────────────────
function ComposeArea({
  group,
  disabled,
}: {
  group: MarmotGroup;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const { mutate: send, isPending } = useSendMessage();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText('');
    send({ group, content: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-gray-800/50 bg-gray-950/80 px-3 py-2.5 md:px-4 md:py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'Reconnecting...' : 'Write a message...'}
          data-testid="compose-input"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-800/50 bg-gray-900/60 px-4 py-2.5
                     text-sm text-gray-100 placeholder-gray-600 outline-none
                     transition-colors focus:border-gray-700 focus:bg-gray-900/80"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          data-testid="send-button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500
                     text-white transition-all hover:bg-indigo-400 active:scale-95
                     disabled:opacity-30 disabled:hover:bg-indigo-500"
        >
          {isPending ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Chat View ─────────────────────────────────────────────
export function ChatView() {
  const { pubkey } = useAuth();
  const { data: marmotGroups = [] } = useGroups();
  const { markRead, isGroupUnread, unreadCount } = useReadState();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateDm, setShowCreateDm] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  // Activate subscriptions — wire reconnect into connection status
  const { reconnect } = useMarmotSubscription();
  const connectionStatus = useConnectionStatus(reconnect);
  useWebNotifications();

  // Stored groups from Dexie (refreshes when marmotGroups or storedGroups query is invalidated)
  const { data: storedGroups = [] } = useQuery({
    queryKey: [...QUERY_KEYS.storedGroups, marmotGroups.length],
    queryFn: () => db.groups.toArray(),
  });

  const selectedMarmotGroup = marmotGroups.find((g) => g.idStr === selectedGroupId) ?? null;
  const selectedStoredGroup = storedGroups.find((g) => g.id === selectedGroupId) ?? null;

  // Mark group as read when opened
  useEffect(() => {
    if (!selectedGroupId || !selectedStoredGroup?.lastMessage) return;
    markRead(selectedGroupId, selectedStoredGroup.lastMessage.createdAt);
  }, [selectedGroupId, selectedStoredGroup, markRead]);

  // Update document title with unread count
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Marmota` : 'Marmota';
  }, [unreadCount]);

  const showChat = !!selectedGroupId;

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100">
      <ConnectionBanner
        isConnected={connectionStatus.isConnected}
        isReconnecting={connectionStatus.isReconnecting}
        onRetry={connectionStatus.reconnect}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`flex w-full flex-col border-r border-gray-800/40 bg-gray-950
                       md:w-80 md:shrink-0 md:flex ${showChat ? 'hidden md:flex' : 'flex'}`}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between border-b border-gray-800/40 px-4 py-3.5">
            <AccountMenu />
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => setShowCreateDm(true)}
                data-testid="new-dm-button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                           transition-colors hover:bg-gray-800/50 hover:text-gray-200"
                title="New DM"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
              </button>
              <button
                onClick={() => setShowCreateGroup(true)}
                data-testid="new-group-button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                           transition-colors hover:bg-gray-800/50 hover:text-gray-200"
                title="New Group"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Group list */}
          <div className="flex-1 overflow-y-auto p-2" data-testid="group-list">
            {storedGroups.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <div className="mb-4 text-2xl text-gray-700">🏔</div>
                <p className="text-sm font-medium text-gray-400">No groups on this device</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-600 max-w-[15rem]">
                  Groups use end-to-end encryption keys that are tied to this
                  browser. Groups created or joined on other devices won't appear here.
                </p>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Create a group →
                </button>
              </div>
            ) : (
              storedGroups
                .sort(
                  (a, b) =>
                    (b.lastMessage?.createdAt ?? b.createdAt) -
                    (a.lastMessage?.createdAt ?? a.createdAt),
                )
                .map((sg) => (
                  <GroupItem
                    key={sg.id}
                    storedGroup={sg}
                    marmotGroup={marmotGroups.find((g) => g.idStr === sg.id) ?? null}
                    myPubkey={pubkey!}
                    isSelected={sg.id === selectedGroupId}
                    isUnread={isGroupUnread(sg)}
                    onClick={() => setSelectedGroupId(sg.id)}
                  />
                ))
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-gray-800/40 px-4 py-3 space-y-2">
            <p className="text-[10px] leading-relaxed text-gray-600">
              Messages are end-to-end encrypted using the Marmot protocol (MLS over
              Nostr). This software is provided as-is with no warranty.
            </p>
          </div>
        </aside>

        {/* Main message area */}
        <main className={`flex flex-1 flex-col ${showChat ? 'flex' : 'hidden md:flex'}`}>
          {selectedGroupId && selectedMarmotGroup ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-gray-800/40 px-4 py-3 md:px-5">
                <button
                  onClick={() => setSelectedGroupId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                             transition-colors hover:bg-gray-800/50 hover:text-gray-200 md:hidden"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 19.5L8.25 12l7.5-7.5"
                    />
                  </svg>
                </button>

                <ChatHeader
                  marmotGroup={selectedMarmotGroup}
                  storedGroup={selectedStoredGroup}
                  myPubkey={pubkey!}
                />

                <button
                  onClick={() => setShowGroupSettings((v) => !v)}
                  data-testid="group-settings-button"
                  className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                             transition-colors hover:bg-gray-800/50 hover:text-gray-200"
                  title="Group settings"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                    />
                  </svg>
                </button>
              </div>

              {/* Group settings panel (slides in) */}
              {showGroupSettings && selectedMarmotGroup && (
                <GroupSettingsPanel
                  group={selectedMarmotGroup}
                  onClose={() => setShowGroupSettings(false)}
                  onLeft={() => {
                    setShowGroupSettings(false);
                    setSelectedGroupId(null);
                  }}
                />
              )}

              {/* Messages */}
              <MessageArea
                groupId={selectedGroupId}
                myPubkey={pubkey!}
                isGroupChat={
                  selectedStoredGroup ? selectedStoredGroup.members.length > 2 : false
                }
              />

              {/* Compose */}
              <ComposeArea
                group={selectedMarmotGroup}
                disabled={!connectionStatus.isConnected}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-4 text-4xl text-gray-800">🏔</div>
              <h2 className="font-display text-xl font-semibold text-gray-600">
                Select a group
              </h2>
              <p className="mt-1.5 text-xs text-gray-700">
                or create a new one with the buttons above
              </p>
              <p className="mt-6 text-[11px] leading-relaxed text-gray-700 max-w-[16rem]">
                Only groups created or joined on this browser appear here.
                Encryption keys are device-specific and don't sync between devices yet.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Dialogs */}
      <CreateGroupDialog open={showCreateGroup} onClose={() => setShowCreateGroup(false)} />
      <CreateGroupDialog
        open={showCreateDm}
        onClose={() => setShowCreateDm(false)}
        dmRecipient=""
      />
    </div>
  );
}

// ─── Chat Header ────────────────────────────────────────────────
function ChatHeader({
  marmotGroup,
  storedGroup,
  myPubkey,
}: {
  marmotGroup: MarmotGroup;
  storedGroup: StoredGroup | null;
  myPubkey: string;
}) {
  const { name, otherPubkey, is1on1, memberCount } = useGroupDisplay(
    marmotGroup,
    storedGroup,
    myPubkey,
  );

  if (is1on1 && otherPubkey) {
    return <ClickableProfile pubkey={otherPubkey} picSize="sm" showSecondary />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/30 text-xs text-indigo-300">
        {(name || 'G')[0]?.toUpperCase()}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-100">{name}</p>
        <p className="text-[10px] text-gray-500">{memberCount} members</p>
      </div>
    </div>
  );
}
