import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Heart, MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { findCommunityCategory } from '@/lib/community-categories';
import { useTranslation } from '@/lib/i18n';
import ReportContentDialog from '@/components/ReportContentDialog';

export default function CommunityPostCard({ post, delay = 0 }) {
  const { t, dateLocale } = useTranslation();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  /** O que esta sendo denunciado agora: o post ou um comentario dele. */
  const [reportTarget, setReportTarget] = useState(null);

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', post.id],
    queryFn: () => api.entities.CommunityComment.listByPost(post.id),
    enabled: showComments,
  });

  /**
   * Curtir e uma chamada so. Antes a tela lia `liked_by`, recalculava a lista e
   * mandava o total junto — dois pais curtindo ao mesmo tempo se sobrescreviam,
   * e a contagem ficava um a menos para sempre. Quem conta agora e o banco.
   */
  const likeMutation = useMutation({
    mutationFn: () =>
      post.has_liked
        ? api.entities.CommunityPost.unlike(post.id)
        : api.entities.CommunityPost.like(post.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  });

  const commentMutation = useMutation({
    mutationFn: (data) => api.entities.CommunityComment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      setCommentText('');
    },
  });

  const catConfig = findCommunityCategory(post.category);

  const handleComment = () => {
    if (!commentText.trim()) return;
    /** Quem escreveu sai do token, nao do corpo: o cliente nao assina em nome de outro. */
    commentMutation.mutate({ post_id: post.id, content: commentText });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400/20 to-emerald-400/20 border border-blue-400/30 flex items-center justify-center text-blue-600 font-medium">
          {post.author_name?.[0] || t('community.post.fallbackInitial')}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-zinc-100 text-sm">{post.author_name}</p>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", catConfig.color)}>
              {t(catConfig.labelKey)}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            {format(new Date(post.created_date), t('common.dateFormats.dayMonthTime'), { locale: dateLocale })}
          </p>
        </div>
      </div>

      <p className="text-zinc-300 text-sm leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>
      {post.has_image && (
        <img
          src={api.entities.CommunityPost.imageUrl(post.id)}
          alt={t('community.create.photoAlt')}
          loading="lazy"
          className="mb-3 w-full max-h-96 rounded-xl object-cover bg-zinc-800"
        />
      )}

      <div className="flex items-center gap-4 pt-3 border-t border-zinc-800">
        <button
          onClick={() => likeMutation.mutate()}
          className={cn(
            "flex items-center gap-1.5 text-sm transition-colors",
            post.has_liked ? "text-red-600" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Heart className={cn("w-4 h-4", post.has_liked && "fill-current")} />
          <span>{post.likes_count || 0}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{t('community.post.comment')}</span>
        </button>
        <button
          onClick={() => setReportTarget({ type: 'post', id: post.id })}
          aria-label={t('community.report.titlePost')}
          className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-600 transition-colors"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>{t('community.report.report')}</span>
        </button>
      </div>
      <ReportContentDialog target={reportTarget} onClose={() => setReportTarget(null)} />

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">
                    {comment.author_name?.[0] || t('community.post.fallbackInitial')}
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl px-3 py-2 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-zinc-300">{comment.author_name}</p>
                      <button
                        onClick={() => setReportTarget({ type: 'comment', id: comment.id })}
                        aria-label={t('community.report.titleComment')}
                        className="text-zinc-600 hover:text-red-600 transition-colors"
                      >
                        <Flag className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-sm text-zinc-400">{comment.content}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('community.post.commentPlaceholder')}
                  className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm placeholder:text-zinc-600"
                  onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                />
                <Button
                  size="icon"
                  aria-label={t('community.post.sendComment')}
                  onClick={handleComment}
                  disabled={!commentText.trim() || commentMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-amber-500 text-white flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}