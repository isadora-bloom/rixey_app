import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {message && (
        <p className="text-sm text-sage-600 mb-6">{message}</p>
      )}
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          size="sm"
          onClick={() => { onConfirm?.(); onClose?.() }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
