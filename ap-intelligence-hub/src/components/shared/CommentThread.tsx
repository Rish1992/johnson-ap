import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { ROLE_CONFIG } from '@/lib/constants';
import type { ApprovalComment } from '@/types/case';
import type { UserRole } from '@/types/user';

interface CommentThreadProps {
  comments: ApprovalComment[];
  onAddComment: (content: string) => void;
  canComment: boolean;
  placeholder?: string;
}

export function CommentThread({
  comments,
  onAddComment,
  canComment,
  placeholder = 'Add a comment...',
}: CommentThreadProps) {
  const [content, setContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleSubmit = () => {
    if (content.trim()) {
      onAddComment(content.trim());
      setContent('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 pb-4">
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No comments yet
            </p>
          )}
          {comments.map((comment) => {
            const initials = comment.authorName
              .split(' ')
              .map((n) => n[0])
              .join('');
            const roleConfig = ROLE_CONFIG[comment.authorRole as UserRole];

            return (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">
                      {comment.authorName}
                    </span>
                    {roleConfig && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {roleConfig.label}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground bg-accent/50 rounded-lg rounded-tl-none p-3 border-l-2 border-primary/30">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {canComment && (
        <div className="pt-3 border-t border-border">
          <div className="flex gap-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              className="min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!content.trim()}
              className="shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {/* <p className="text-[11px] text-muted-foreground/60 mt-1.5 ml-1">
            Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">&#8984;Enter</kbd> to send
          </p> */}
        </div>
      )}
    </div>
  );
}
