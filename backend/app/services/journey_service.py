"""Recursive journey: virtual root (Level 1) -> root nodes (Level 2) -> ... (Level 4)."""

import uuid
from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import ContentDepth, ContentTargetType, JourneyNodeType, NoteTargetType
from app.models import CareEvent, FamilyFacingContent, JourneyNode
from app.schemas.journey import Breadcrumb, CarePath, JourneyNodeDetail, JourneyNodeOut
from app.services import family_view_service as fvs
from app.services import outlook_service
from app.services.notes_service import notes_by_target
from app.services.patient_access_service import AccessContext

ROOT_ID = "root"
ROOT_CRUMB = Breadcrumb(id=ROOT_ID, title="My Care Journey")
CARE_PATH_NOTE = (
    "Care plans can change. These are possible paths, not a schedule. "
    "Your care team will explain what comes next when it is known."
)


class _Tree:
    def __init__(self, db: Session, patient_id: uuid.UUID):
        nodes = db.scalars(
            select(JourneyNode)
            .where(JourneyNode.patient_id == patient_id)
            .order_by(JourneyNode.display_order, JourneyNode.title)
        ).all()
        self.by_id = {n.id: n for n in nodes}
        self.children: dict[uuid.UUID | None, list[JourneyNode]] = defaultdict(list)
        for n in nodes:
            self.children[n.parent_node_id].append(n)
        event_ids = [n.care_event_id for n in nodes if n.care_event_id]
        self.event_types = (
            dict(db.execute(select(CareEvent.id, CareEvent.event_type).where(CareEvent.id.in_(event_ids))).all())
            if event_ids
            else {}
        )
        # Forward-looking hint on the "Next steps" root and the current stay's next-step child.
        self.hint = outlook_service.journey_hint(db, patient_id)
        self.hint_ids: set[uuid.UUID] = set()
        if self.hint:
            for root in self.children.get(None, []):
                if root.node_type == JourneyNodeType.NEXT_STEP:
                    self.hint_ids.add(root.id)
                elif root.is_current:
                    self.hint_ids.update(
                        c.id for c in self.children.get(root.id, []) if c.node_type == JourneyNodeType.NEXT_STEP
                    )

    def out(self, n: JourneyNode) -> JourneyNodeOut:
        return JourneyNodeOut(**self._fields(n))

    def _fields(self, n: JourneyNode) -> dict:
        return dict(
            id=str(n.id),
            title=n.title,
            subtitle=n.subtitle,
            node_type=n.node_type,
            state=n.state,
            is_current=n.is_current,
            icon_key=n.icon_key,
            has_children=bool(self.children.get(n.id)),
            display_order=n.display_order,
            start_at=n.start_at,
            end_at=n.end_at,
            occurred_at=n.occurred_at,
            home_interval_id=n.home_interval_id,
            event_type=self.event_types.get(n.care_event_id) if n.care_event_id else None,
            outlook_hint=self.hint if n.id in self.hint_ids else None,
        )

    def ancestors(self, n: JourneyNode) -> list[JourneyNode]:
        chain, cur = [], n
        while cur.parent_node_id is not None:
            cur = self.by_id[cur.parent_node_id]
            chain.append(cur)
        return list(reversed(chain))


def get_root(db: Session, ctx: AccessContext) -> JourneyNodeDetail:
    tree = _Tree(db, ctx.patient.id)
    roots = tree.children.get(None, [])
    first = ctx.patient.first_name
    return JourneyNodeDetail(
        id=ROOT_ID,
        title=f"{first}'s Care Journey",
        subtitle=None,
        node_type=None,
        state=None,
        is_current=False,
        icon_key="route",
        has_children=bool(roots),
        display_order=0,
        start_at=None,
        end_at=None,
        occurred_at=None,
        home_interval_id=None,
        event_type=None,
        level=1,
        patient_id=ctx.patient.id,
        heading=f"Where has {first}'s care journey gone so far?",
        breadcrumbs=[ROOT_CRUMB],
        parent_id=None,
        children=[tree.out(n) for n in roots],
        content=None,
    )


def get_node(
    db: Session, ctx: AccessContext, node_id: uuid.UUID, depth: ContentDepth
) -> JourneyNodeDetail:
    tree = _Tree(db, ctx.patient.id)
    node = tree.by_id.get(node_id)
    if node is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journey step not found.")

    ancestors = tree.ancestors(node)
    rows = db.scalars(
        select(FamilyFacingContent).where(
            FamilyFacingContent.patient_id == ctx.patient.id,
            FamilyFacingContent.target_type == ContentTargetType.JOURNEY_NODE,
            FamilyFacingContent.target_id == node.id,
        )
    ).all()
    names = fvs.reviewer_names(db, rows)
    viewer = ctx.viewer
    return JourneyNodeDetail(
        **tree._fields(node),
        level=len(ancestors) + 2,
        patient_id=ctx.patient.id,
        heading=node.heading,
        breadcrumbs=[ROOT_CRUMB]
        + [Breadcrumb(id=str(a.id), title=a.title) for a in ancestors]
        + [Breadcrumb(id=str(node.id), title=node.title)],
        parent_id=str(node.parent_node_id) if node.parent_node_id else ROOT_ID,
        children=[tree.out(c) for c in tree.children.get(node.id, [])],
        content=fvs.select_content(rows, depth, viewer, names),
        restricted_content=fvs.restricted_content(rows, viewer, names),
        care_team_notes=notes_by_target(
            db, ctx.patient.id, viewer, NoteTargetType.JOURNEY_NODE, [node.id]
        ).get(node.id, []),
    )


def care_path(db: Session, ctx: AccessContext) -> CarePath:
    tree = _Tree(db, ctx.patient.id)
    roots = tree.children.get(None, [])
    current = next((n for n in roots if n.is_current), None)
    next_steps = next((n for n in roots if n.node_type == JourneyNodeType.NEXT_STEP), None)
    options = tree.children.get(next_steps.id, []) if next_steps else []
    return CarePath(
        current=tree.out(current) if current else None,
        options=[tree.out(o) for o in options],
        note=CARE_PATH_NOTE,
    )
