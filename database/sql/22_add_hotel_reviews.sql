USE LuxeReserve;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.HotelReview', 'U') IS NULL
BEGIN
    CREATE TABLE HotelReview (
        hotel_review_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
        hotel_id                BIGINT          NOT NULL,
        guest_id                BIGINT          NOT NULL,
        reservation_id          BIGINT          NOT NULL,
        rating_score            INT             NOT NULL,
        review_title            NVARCHAR(150)   NULL,
        review_text             NVARCHAR(1500)  NOT NULL,
        public_visible_flag     BIT             NOT NULL DEFAULT 1,
        moderation_status       VARCHAR(15)     NOT NULL DEFAULT 'PUBLISHED',
        created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_HotelReview_Hotel FOREIGN KEY (hotel_id) REFERENCES Hotel(hotel_id),
        CONSTRAINT FK_HotelReview_Guest FOREIGN KEY (guest_id) REFERENCES Guest(guest_id),
        CONSTRAINT FK_HotelReview_Reservation FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
        CONSTRAINT UQ_HotelReview_Reservation UNIQUE (reservation_id),
        CONSTRAINT CK_HotelReview_Rating CHECK (rating_score BETWEEN 1 AND 5),
        CONSTRAINT CK_HotelReview_Moderation CHECK (moderation_status IN ('PUBLISHED','HIDDEN'))
    );

    CREATE INDEX IX_HotelReview_HotelPublished ON HotelReview(hotel_id, public_visible_flag, moderation_status, created_at DESC);
    CREATE INDEX IX_HotelReview_GuestCreated ON HotelReview(guest_id, created_at DESC);
END;
GO

PRINT '[OK] HotelReview table ensured.';
GO
