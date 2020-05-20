import React, { useRef, useEffect, useState, Validator } from 'react'
import ChatListContextMenu from './ChatListContextMenu'
import {
  useChatListIds,
  useLazyChatListItems,
  useMessageResults,
} from './ChatListHelpers'
import ChatListItem, {
  ChatListItemMessageResult,
  PlaceholderChatListItem,
} from './ChatListItem'
import { PseudoListItemAddContact } from '../helpers/PseudoListItem'
import { C } from 'deltachat-node/dist/constants'
import { selectChat } from '../../stores/chat'
import { DeltaBackend } from '../../delta-remote'
import { isValidEmail } from '../../../shared/util'
import { ContactListItem } from '../contact/ContactListItem'
import { useContactIds } from '../contact/ContactList'
import {
  ChatListItemType,
  MessageSearchResult,
  DCContact,
} from '../../../shared/shared-types'

import {
  AutoSizer,
  List,
  InfiniteLoader,
  Index,
  WindowScroller,
  IndexRange,
  ListRowRenderer,
  ScrollParams,
  OnScrollParams,
} from 'react-virtualized'

const CHATLISTITEM_HEIGHT = 64
const DIVIDER_HEIGHT = 40

const enum LoadStatus {
  FETCHING = 1,
  LOADED = 2,
}

function ChatListPart({
  isRowLoaded,
  loadMoreRows,
  rowCount,
  width,
  children,
  height,
}: {
  isRowLoaded: (params: Index) => boolean
  loadMoreRows: (params: IndexRange) => Promise<any>
  rowCount: number
  width: number
  children: ListRowRenderer
  height: number
}) {
  return (
    <InfiniteLoader
      isRowLoaded={isRowLoaded}
      loadMoreRows={loadMoreRows}
      rowCount={rowCount}
      minimumBatchSize={1}
    >
      {({ onRowsRendered, registerChild }) => (
        <List
          ref={registerChild}
          rowHeight={CHATLISTITEM_HEIGHT}
          height={height}
          onRowsRendered={onRowsRendered}
          rowRenderer={children}
          rowCount={rowCount}
          width={width}
        />
      )}
    </InfiniteLoader>
  )
}

export default function ChatList(props: {
  selectedChatId: number
  showArchivedChats: boolean
  onShowArchivedChats: () => void
  queryStr?: string
  onChatClick: (chatId: number) => void
}) {
  const {
    selectedChatId,
    showArchivedChats,
    onShowArchivedChats,
    queryStr,
  } = props
  const isSearchActive = queryStr !== ''
  const queryStrIsEmail = isValidEmail(queryStr)
  const realOpenContextMenu = useRef(null)

  const {
    chatListIds,
    contactIds,
    messageResultIds,
    isMessageLoaded,
    loadMessages,
    messageCache,
    isContactLoaded,
    loadContact,
    contactCache,
    isChatLoaded,
    loadChats,
    chatCache,
  } = useLogic(queryStr, showArchivedChats)

  const onChatClick = (chatId: number) => {
    if (chatId === C.DC_CHAT_ID_ARCHIVED_LINK) return onShowArchivedChats()
    props.onChatClick(chatId)
  }

  const openContextMenu = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    chatId: number
  ) => {
    if (realOpenContextMenu.current === null)
      throw new Error(
        'Tried to open ChatListContextMenu before we recieved open method'
      )
    const chat = chatCache[chatId]
    realOpenContextMenu.current(event, chat)
  }

  const addContactOnClick = async () => {
    if (!queryStrIsEmail) return

    const contactId = await DeltaBackend.call(
      'contacts.createContact',
      queryStr
    )
    const chatId = await DeltaBackend.call(
      'contacts.createChatByContactId',
      contactId
    )
    selectChat(chatId)
  }

  // Render ------------------
  return (
    <>
      <div className='chat-list'>
        <AutoSizer>
          {({ width, height }) => (
            <div>
              {isSearchActive && (
                <div className='search-result-divider' style={{ width: width }}>
                  {translate_n('n_chats', chatListIds.length)}
                </div>
              )}
              <ChatListPart
                isRowLoaded={isChatLoaded}
                loadMoreRows={loadChats}
                rowCount={chatListIds.length}
                width={width}
                height={
                  isSearchActive
                    ? Math.min(
                        height / 3 - DIVIDER_HEIGHT,
                        chatListIds.length * CHATLISTITEM_HEIGHT
                      )
                    : height
                }
              >
                {({ index, key, style }) => {
                  const chatId = chatListIds[index]
                  return (
                    <div style={style}>
                      <ChatListItem
                        isSelected={selectedChatId === chatId}
                        key={key}
                        chatListItem={chatCache[chatId] || undefined}
                        onClick={onChatClick.bind(null, chatId)}
                        onContextMenu={event => {
                          openContextMenu(event, chatId)
                        }}
                      />
                    </div>
                  )
                }}
              </ChatListPart>
              {isSearchActive && (
                <>
                  <div
                    className='search-result-divider'
                    style={{ width: width }}
                  >
                    {translate_n('n_contacts', contactIds.length)}
                  </div>
                  <ChatListPart
                    isRowLoaded={isContactLoaded}
                    loadMoreRows={loadContact}
                    rowCount={contactIds.length}
                    width={width}
                    height={Math.min(
                      height / 3 - DIVIDER_HEIGHT,
                      contactIds.length * CHATLISTITEM_HEIGHT
                    )}
                  >
                    {({ index, key, style }) => {
                      const contactId = contactIds[index]
                      return (
                        <div key={key} style={style}>
                          {contactCache[contactId] ? (
                            <ContactListItem
                              contact={contactCache[contactId]}
                              showCheckbox={false}
                              checked={false}
                              showRemove={false}
                              onClick={async _ => {
                                let chatId = await DeltaBackend.call(
                                  'contacts.getChatIdByContactId',
                                  contactId
                                )
                                onChatClick(chatId)
                              }}
                            />
                          ) : (
                            <PlaceholderChatListItem />
                          )}
                        </div>
                      )
                    }}
                  </ChatListPart>
                  {chatListIds.length > 0 ||
                    PseudoListItemAddContact({
                      queryStr,
                      queryStrIsEmail,
                      onClick: addContactOnClick,
                    })}
                  <div
                    className='search-result-divider'
                    style={{ width: width }}
                  >
                    {translate_n('n_messages', messageResultIds.length)}
                  </div>

                  <ChatListPart
                    isRowLoaded={isMessageLoaded}
                    loadMoreRows={loadMessages}
                    rowCount={messageResultIds.length}
                    width={width}
                    height={Math.min(
                      height / 3 - DIVIDER_HEIGHT,
                      messageResultIds.length * CHATLISTITEM_HEIGHT
                    )}
                  >
                    {({ index, key, style }) => {
                      const msrId = messageResultIds[index]
                      return (
                        <div style={style} key={key}>
                          {messageCache[msrId] ? (
                            <ChatListItemMessageResult
                              msr={messageCache[msrId]}
                              onClick={() => {
                                console.log(
                                  'Clicked on MessageResult with Id',
                                  msrId
                                )
                              }}
                            />
                          ) : (
                            <div className='chat-list-item skeleton' />
                          )}
                        </div>
                      )
                    }}
                  </ChatListPart>
                </>
              )}
            </div>
          )}
        </AutoSizer>
      </div>
      <ChatListContextMenu
        showArchivedChats={showArchivedChats}
        getShow={show => {
          realOpenContextMenu.current = show
        }}
      />
    </>
  )
}

function translate_n(key: string, quantity: number) {
  return window.translate(key, String(quantity), { quantity }).toUpperCase()
}

function useLogic(queryStr: string, showArchivedChats: boolean) {
  const { chatListIds, setQueryStr, setListFlags } = useChatListIds()
  const [contactIds, updateContactSearch] = useContactIds(0, queryStr)
  const [messageResultIds, updateMessageResult] = useMessageResults(queryStr, 0)

  // Chat --------------------
  const [chatCache, setChatCache] = useState<{
    [id: number]: ChatListItemType
  }>({})
  const [chatLoadState, setChatLoading] = useState<{
    [id: number]: undefined | LoadStatus.FETCHING | LoadStatus.LOADED
  }>({})

  const isChatLoaded: (params: Index) => boolean = ({ index }) =>
    !!chatLoadState[chatListIds[index]]
  const loadChats: (params: IndexRange) => Promise<void> = async ({
    startIndex,
    stopIndex,
  }) => {
    const chatIds =
      startIndex == stopIndex
        ? [chatListIds[startIndex]]
        : chatListIds.slice(startIndex, stopIndex)
    setChatLoading(state => {
      chatIds.forEach(id => (state[id] = LoadStatus.FETCHING))
      return state
    })
    const chats = await DeltaBackend.call(
      'chatList.getChatListItemsByIds',
      chatIds
    )
    setChatCache(cache => ({ ...cache, ...chats }))
    setChatLoading(state => {
      chatIds.forEach(id => (state[id] = LoadStatus.LOADED))
      return state
    })
  }

  // todo listen for chat change events and react
  // todo fix archived chat link

  // Contacts ----------------
  const [contactCache, setContactCache] = useState<{
    [id: number]: DCContact
  }>({})
  const [contactLoadState, setContactLoading] = useState<{
    [id: number]: undefined | LoadStatus.FETCHING | LoadStatus.LOADED
  }>({})

  const isContactLoaded: (params: Index) => boolean = ({ index }) =>
    !!contactLoadState[contactIds[index]]
  const loadContact: (params: IndexRange) => Promise<void> = async ({
    startIndex,
    stopIndex,
  }) => {
    const ids =
      startIndex == stopIndex
        ? [contactIds[startIndex]]
        : contactIds.slice(startIndex, stopIndex)

    setContactLoading(state => {
      ids.forEach(id => (state[id] = LoadStatus.FETCHING))
      return state
    })
    const contacts = await DeltaBackend.call('contacts.getContacts', ids)
    setContactCache(cache => ({ ...cache, ...contacts }))
    setContactLoading(state => {
      ids.forEach(id => (state[id] = LoadStatus.LOADED))
      return state
    })
  }

  // Message ----------------
  const [messageCache, setMessageCache] = useState<{
    [id: number]: MessageSearchResult
  }>({})
  const [messageLoadState, setMessageLoading] = useState<{
    [id: number]: undefined | LoadStatus.FETCHING | LoadStatus.LOADED
  }>({})

  const isMessageLoaded: (params: Index) => boolean = ({ index }) =>
    !!messageLoadState[messageResultIds[index]]
  const loadMessages: (params: IndexRange) => Promise<void> = async ({
    startIndex,
    stopIndex,
  }) => {
    const ids =
      startIndex == stopIndex
        ? [messageResultIds[startIndex]]
        : messageResultIds.slice(startIndex, stopIndex)

    setMessageLoading(state => {
      ids.forEach(id => (state[id] = LoadStatus.FETCHING))
      return state
    })
    const messages = await DeltaBackend.call(
      'messageList.msgIds2SearchResultItems',
      ids
    )
    setMessageCache(cache => ({ ...cache, ...messages }))
    setMessageLoading(state => {
      ids.forEach(id => (state[id] = LoadStatus.LOADED))
      return state
    })
  }

  // effects
  useEffect(() => {
    setQueryStr(queryStr)
    updateContactSearch(queryStr)
    updateMessageResult(queryStr)
  }, [queryStr])

  useEffect(() => {
    // force refresh of inital data
    loadChats({ startIndex: 0, stopIndex: Math.min(chatListIds.length, 10) })
    loadContact({ startIndex: 0, stopIndex: Math.min(contactIds.length, 10) })
    loadMessages({
      startIndex: 0,
      stopIndex: Math.min(messageResultIds.length, 10),
    })
  }, [chatListIds, contactIds, messageResultIds])

  useEffect(
    () =>
      showArchivedChats
        ? setListFlags(C.DC_GCL_ARCHIVED_ONLY)
        : setListFlags(0),
    [showArchivedChats]
  )

  return {
    chatListIds,
    contactIds,
    messageResultIds,
    isMessageLoaded,
    loadMessages,
    messageCache,
    isContactLoaded,
    loadContact,
    contactCache,
    isChatLoaded,
    loadChats,
    chatCache,
  }
}
