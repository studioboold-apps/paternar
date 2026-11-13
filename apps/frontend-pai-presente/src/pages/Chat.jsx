import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lightbulb } from 'lucide-react';
import AiIcon from '@/components/AiIcon';
import ChatComposer from '@/components/ChatComposer';
import ExpandableMarkdown from '@/components/ExpandableMarkdown';
import ChildQuickAccess from '@/components/ChildQuickAccess';
import BrandLoader from '@/components/BrandLoader';
import PlanUpsell from '@/components/PlanUpsell';
import { BRAND_LOGO } from '@/lib/brand';
import { useTranslation } from '@/lib/i18n';
import { MESSAGE_ROLES, SUGGESTED_QUESTION_KEYS, useChat } from './Chat.hook';

export default function Chat() {
  const { t } = useTranslation();
  const {
    question,
    messages,
    sendFailure,
    attachmentFailure,
    isSending,
    canSend,
    messagesEndRef,
    inputRef,
    handleQuestionChange,
    handleSubmit,
    sendQuestion,
    photo,
    voice,
    planBlock,
    chatRemaining,
  } = useChat();

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <div className="bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800 px-4 py-4 flex items-center gap-3">
        <img src={BRAND_LOGO} alt={t('chat.brandLogoAlt')} className="w-10 h-10 rounded-xl" />
        <div>
          <h1 className="font-medium text-zinc-100">{t('chat.title')}</h1>
          <p className="text-xs text-zinc-500">{t('chat.subtitle')}</p>
        </div>
        <ChildQuickAccess />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-32">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
              <Lightbulb aria-hidden="true" className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-medium text-zinc-100 mb-2">{t('chat.emptyTitle')}</h2>
            <p className="text-zinc-500 text-sm mb-6 max-w-xs">{t('chat.emptyBody')}</p>

            <div className="space-y-2 w-full max-w-sm">
              <p className="text-xs text-zinc-600 uppercase tracking-wide">
                {t('chat.suggestionsLabel')}
              </p>
              {SUGGESTED_QUESTION_KEYS.map((questionKey, index) => (
                <motion.button
                  key={questionKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => sendQuestion(t(questionKey))}
                  className="w-full text-left p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-sm text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-all"
                >
                  {t(questionKey)}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${message.role === MESSAGE_ROLES.USER ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === MESSAGE_ROLES.ASSISTANT && (
                    <div
                      aria-label={t('chat.assistantAvatarLabel')}
                      className="w-8 h-8 rounded-full bg-blue-400/20 flex-shrink-0 flex items-center justify-center"
                    >
                      <AiIcon aria-hidden="true" className="w-4 h-4 text-blue-600" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === MESSAGE_ROLES.USER
                        ? 'bg-gradient-to-r from-blue-500 to-amber-500 text-white'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
                    }`}
                  >
                    {message.imageUrl && (
                      <img
                        src={message.imageUrl}
                        alt={t('chat.photoPreviewAlt')}
                        className="mb-2 max-h-48 rounded-lg object-cover"
                      />
                    )}
                    {message.role === MESSAGE_ROLES.USER ? (
                      <p className="text-sm">{message.content}</p>
                    ) : (
                      <ExpandableMarkdown
                        className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                        moreLabel={t('chat.showMore')}
                        lessLabel={t('chat.showLess')}
                      >
                        {message.content}
                      </ExpandableMarkdown>
                    )}
                  </div>

                  {message.role === MESSAGE_ROLES.USER && (
                    <div
                      aria-label={t('chat.userAvatarLabel')}
                      className="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center"
                    >
                      <User aria-hidden="true" className="w-4 h-4 text-zinc-400" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isSending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-blue-400/20 flex-shrink-0 flex items-center justify-center">
                  <AiIcon aria-hidden="true" className="w-4 h-4 text-blue-600" />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
                  <BrandLoader size="sm" />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {planBlock ? (
        <PlanUpsell {...planBlock} className="mx-4 mb-2" />
      ) : chatRemaining !== null ? (
        <p className="px-4 pb-1 text-center text-xs text-zinc-500">
          {t('planUpsell.remaining', { count: chatRemaining })}
        </p>
      ) : null}
      <ChatComposer
        question={question}
        sendFailure={sendFailure}
        attachmentFailure={attachmentFailure}
        isSending={isSending}
        canSend={canSend}
        inputRef={inputRef}
        handleQuestionChange={handleQuestionChange}
        handleSubmit={handleSubmit}
        photo={photo}
        voice={voice}
      />
    </div>
  );
}
